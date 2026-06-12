const express = require("express");
const path = require("path");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = 3001; // port différent pour ne pas conflit avec le web-app (3000)

// Connexion MongoDB (même base que le web-app)
const client = new MongoClient("mongodb://localhost:27017");
let db;

async function connectDB() {
    await client.connect();
    db = client.db("20263IFMongoLab");
    console.log("MongoDB connecté");
}

// Sert les fichiers statiques du dossier public/
app.use(express.static(path.join(__dirname, "public")));

// ---- REQUÊTE MONGODB COMPLEXE ----
// On utilise une agrégation $project pour calculer le taux de remplissage
// de chaque station : fillRate = available_bikes / bike_stands * 100
// On projette aussi les coordonnées et infos utiles pour la carte.
// C'est plus qu'un simple find() : on calcule un champ dérivé côté MongoDB.
app.get("/api/stations", async (req, res) => {
    try {
        const results = await db.collection("velov2026").aggregate([
            {
                // $project : on calcule fillRate avec $cond pour éviter division par 0
                $project: {
                    _id: 0,
                    name: 1,
                    address: 1,
                    commune: 1,
                    status: 1,
                    lat: 1,
                    lng: 1,
                    available_bikes: 1,
                    bike_stands: 1,
                    // taux de remplissage en % arrondi à 1 décimale
                    fillRate: {
                        $cond: {
                            if:   { $gt: ["$bike_stands", 0] },
                            then: { $multiply: [{ $divide: ["$available_bikes", "$bike_stands"] }, 100] },
                            else: 0
                        }
                    }
                }
            },
            // On ne garde que les stations avec des coordonnées valides
            { $match: { lat: { $exists: true }, lng: { $exists: true } } }
        ]).toArray();

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// Démarrage : connexion DB puis serveur
connectDB().then(() => {
    app.listen(PORT, () => console.log("Bonus server actif sur http://localhost:" + PORT));
});
