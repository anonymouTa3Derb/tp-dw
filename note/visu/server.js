const express = require("express");
const path = require("path");
const { connectToServer, getDb } = require('./db');

const app = express();
const PORT = 3002;

app.use(express.static(path.join(__dirname, 'public')));

// Types de POI disponibles pour le filtre
app.get("/api/poiTypes", async (req, res) => {
    try {
        const types = await getDb().collection("touristPOI").distinct("properties.type");
        res.json(types.filter(Boolean).sort());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Pour chaque station Vélov', on calcule le nombre de POI du type demandé
// dans le rayon donné, et on renvoie la liste des noms pour le popup.
app.get("/api/map-data", async (req, res) => {
    try {
        const { poiType } = req.query;
        const range = parseFloat(req.query.range) || 500;

        const stations = await getDb().collection("velov2026").aggregate([
            {
                $lookup: {
                    from: "touristPOI",
                    let: { lat: "$lat", lng: "$lng" },
                    pipeline: [
                        { $match: { "properties.type": poiType } },
                        {
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
                        { $project: { _id: 0, "properties.nom": 1 } }
                    ],
                    as: "pois"
                }
            },
            {
                $project: {
                    _id: 0,
                    name: 1,
                    lat: 1,
                    lng: 1,
                    status: 1,
                    pois: 1,
                    poiCount: { $size: "$pois" }
                }
            }
        ]).toArray();

        res.json(stations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

connectToServer().then(() => {
    app.listen(PORT, () => console.log("Visu server actif sur http://localhost:" + PORT));
});
