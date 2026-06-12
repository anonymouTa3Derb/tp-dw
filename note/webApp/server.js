const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

const { connectToServer, getDb } = require('./db');

app.use(express.static(path.join(__dirname, 'public')));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---- 3.1 : Liste unique des communes des stations Vélov' ----
app.get("/api/communes", async (req, res) => {
    try {
        const communes = await getDb().collection("velov2026").distinct("commune");
        res.json(communes.filter(Boolean).sort());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Liste unique des types de POI (pour le 2e dropdown - question 3.2)
app.get("/api/poiTypes", async (req, res) => {
    try {
        const types = await getDb().collection("touristPOI").distinct("type");
        res.json(types.filter(Boolean).sort());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- 3.2 / 3.3 : Stations Vélov' d'une commune + POI à proximité ----
// Paramètres : commune (string), poiType (string), range (number, défaut 500 m)
// Retourne uniquement les stations ayant au moins un POI à proximité.
// La distance est calculée avec une approximation planaire (valable sur de petites zones) :
//   1° de latitude  ≈ 111 000 m
//   1° de longitude ≈  77 000 m (à la latitude de Lyon ~45.75°N)
app.get("/api/search", async (req, res) => {
    try {
        const { commune, poiType } = req.query;
        const range = parseFloat(req.query.range) || 500;

        const results = await getDb().collection("velov2026").aggregate([
            // Filtre sur la commune sélectionnée
            { $match: { commune } },
            {
                $lookup: {
                    from: "touristPOI",
                    let: { lat: "$lat", lng: "$lng" },
                    pipeline: [
                        // On ne garde que les POI du type demandé
                        { $match: { type: poiType } },
                        {
                            // Calcul de la distance approximative en mètres
                            $match: {
                                $expr: {
                                    $lt: [
                                        {
                                            $sqrt: {
                                                $add: [
                                                    { $pow: [{ $multiply: [{ $subtract: ["$$lat", { $arrayElemAt: ["$geometry.coordinates", 1] }] }, 111000] }, 2] },
                                                    { $pow: [{ $multiply: [{ $subtract: ["$$lng", { $arrayElemAt: ["$geometry.coordinates", 0] }] }, 77000] }, 2] }
                                                ]
                                            }
                                        },
                                        range
                                    ]
                                }
                            }
                        },
                        // Projette uniquement les champs utiles pour le tableau HTML
                        { $project: { _id: 0, nom: 1, theme: 1, "address.streetAddress": 1 } }
                    ],
                    as: "pois"
                }
            },
            // Exclut les stations sans POI à proximité
            { $match: { "pois.0": { $exists: true } } },
            { $project: { _id: 0, name: 1, address: 1, commune: 1, pois: 1 } }
        ]).toArray();

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Boot sequence : connexion DB puis démarrage du serveur
connectToServer().then(() => {
    app.listen(PORT, () => {
        console.log("Serveur actif sur http://localhost:" + PORT);
    });
});
