const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

const { connectToServer, getDb } = require('./db');

app.use(express.static(path.join(__dirname, 'public')));

// Route with MongoDB query to get all stations
app.get('/api/stations', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection("velov2026");
	//simple MongoDB query with a projection
        const results = await collection.find({},{ name: 1, commune : 1, _id: 0 }).toArray();
        res.json(results);
    } catch (err) {
        res.status(500).send("Fetch error in Get all stations");
    }
});

app.get('/api/communes', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection("velov2026");
        //simple MongoDB query with a projection
        const results = await collection.distinct("commune");
        res.json(results);
    } catch (err) {
        res.status(500).send("Fetch error in Get all communes");
    }
});

// Route to get the index.html file
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


// Boot sequence : connect to the database and start the server
connectToServer().then(() => {
    app.listen(PORT, () => {
        console.log("Server active on port"+PORT);
    });
});


// Route with MongoDB query to get stations with a given status
app.get("/api/status_filtered_stations", async (req, res) => {
    try {
    //retrieve status value from the client request
        const status = req.query.status;
        const commune = req.query.commune;
        
        const db = getDb();
        const collection = db.collection("velov2026");

        //build a json object with the search query
        let filter = {};
        if (status) 
        {
            filter.status = status;
        }
        if (commune)
        {
            filter.commune = commune;
        }

        const stations = await collection
            .find(filter, { name: 1, status: 1, commune : 1, _id: 0  })
            .toArray();

        res.json(stations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fetch error in status_filtered_stations" });
    }
});

app.get("/api/svg_filtered_stations", async (req, res) => {
    
    try {
        const commune = req.query.commune;
        
        const db = getDb();
        const collection = db.collection("velov2026");

        //build a json object with the search query
        let filter = {};
        if (commune)
        {
            filter.commune = commune;
            filter.status = "OPEN"; //we only want open stations for the svg map
        }

        const stations = await collection
            .find(filter, { name: 1, status: 1, commune : 1, _id: 0  })
            .toArray();

        res.json(stations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fetch error in status_filtered_stations" });
    }
});

app.get("/api/stats_stations", async (req, res) => {
        
    console.log("Stats request received with query:", req.query);

    try
    {
        
        const commune = req.query.commune;
        console.log("Received stats request for commune:", commune);
        
        const db = getDb();
        const collection = db.collection("velov2026");
        
         const results = await collection.aggregate([
            {
                $match: { commune: commune }   // filtre sur la commune
            },
            {
                $group: {
                    _id: "$commune",
                    total_bikes: { $sum: "$available_bikes" }, // somme des vélos dispos
                    avg_bikes:   { $avg: "$available_bikes" }, // moyenne des vélos dispos
                    nb_stations: { $sum: 1 }                  // bonus : nb de stations
                }
            }
        ]).toArray();


        if (results.length === 0) { //cas exception ou la commune gettée n'existe pas 
            return res.status(404).json({ error: "Commune not found" });
        }

        const stat = results[0];
        res.json({
            name:        stat._id,
            total:       stat.total_bikes,
            average:     parseFloat(stat.avg_bikes.toFixed(2)),
            nb_stations: stat.nb_stations
        });

    }
    catch (err)    {
        console.error(err);
        res.status(500).json({ error: "Fetch error in stats_stations" });
    }
});
