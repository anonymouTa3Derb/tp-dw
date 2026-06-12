# CR TP Noté – Données pour le Web

**ESSAKI Mehdi – CHALMIN Lola**  
**20231511 – 20250952**

---

## Question 1.1 – Simplification de la collection `touristPOI_c`

Le fichier importé est un GeoJSON FeatureCollection : MongoDB le stocke en un seul document avec un tableau `features`. On `$unwind` ce tableau, on remonte chaque feature à la racine avec `$replaceRoot`, puis `$out` écrit le résultat dans la nouvelle collection.

**Requête MongoDB :**
```js
db.touristPOI_c.aggregate([
  { $unwind: "$features" },
  { $replaceRoot: { newRoot: "$features" } },
  { $out: "touristPOI" }
])
```

Après cette requête, chaque document de `touristPOI` a la structure GeoJSON Feature :
```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [4.835, 45.762] },
  "properties": {
    "type": "RESTAURATION",
    "nom": "Brasserie de L'Est",
    "theme": ["Restaurants & Gastronomie"],
    "address": { "streetAddress": "...", "postalCode": "69001" },
    ...
  }
}
```

---

## Question 1.2 – Types distincts de POI

**Requête MongoDB :**
```js
db.touristPOI.distinct("properties.type")
```

**Résultats obtenus :**
```
[
  'ACTIVITE',
  'COMMERCE_ET_SERVICE',
  'DEGUSTATION',
  'EQUIPEMENT',
  'FETE_ET_MANIFESTATION',
  'HEBERGEMENT_COLLECTIF',
  'HEBERGEMENT_LOCATIF',
  'HOTELLERIE',
  'HOTELLERIE_PLEIN_AIR',
  'PATRIMOINE_CULTUREL',
  'RESTAURATION'
]
```

---

## Question 1.3 – Thèmes distincts par type, triés par nombre de thèmes décroissant

`properties.theme` étant un tableau, on commence par `$unwind` pour avoir un document par thème, puis on groupe par type avec `$addToSet` pour dédoublonner. Le `$project` calcule ensuite la taille du tableau avant le tri.

**Requête MongoDB :**
```js
db.touristPOI.aggregate([
  { $match: { "properties.theme": { $exists: true } } },
  { $unwind: "$properties.theme" },
  {
    $group: {
      _id: "$properties.type",
      distinctThemes: { $addToSet: "$properties.theme" }
    }
  },
  {
    $project: {
      distinctThemes: 1,
      themeCount: { $size: "$distinctThemes" }
    }
  },
  { $sort: { themeCount: -1 } },
  { $limit : 5 }
])
```

**5 premiers résultats (on a rajouté un champ qui permet de voir quels sont les thèmes distincts pour vérifier que le compte est bon ) :**
```
[
  {
    _id: 'COMMERCE_ET_SERVICE',
    distinctThemes: [
      'Hébergements',
      'Culture & Musées',
      'Lyon Pratique',
      'Restaurants & Gastronomie',
      'Activités, Loisirs et Bien-être',
      'Shopping'
    ],
    themeCount: 6
  },
  {
    _id: 'EQUIPEMENT',
    distinctThemes: [
      'Culture & Musées',
      'Nocturne',
      'Activités, Loisirs et Bien-être',
      'Lieux de spectacles',
      'Lyon Pratique',
      'Restaurants & Gastronomie'
    ],
    themeCount: 6
  },
  {
    _id: 'PATRIMOINE_CULTUREL',
    distinctThemes: [
      'Patrimoine - Unesco',
      'Activités, Loisirs et Bien-être',
      'Culture & Musées'
    ],
    themeCount: 3
  },
  {
    _id: 'ACTIVITE',
    distinctThemes: [ 'Lyon Pratique', 'Agenda', 'Activités, Loisirs et Bien-être' ],
    themeCount: 3
  },
  {
    _id: 'RESTAURATION',
    distinctThemes: [ 'Restaurants & Gastronomie', 'Nocturne' ],
    themeCount: 2
  }
]
```


---

## Question 2.1 – $lookup par comparaison d'adresse

On joint les deux collections sur l'adresse : `properties.address.streetAddress` côté POI avec `address` des stations Vélov'. Les correspondances exactes restent rares (formats différents), mais le résultat montre que le mécanisme fonctionne.

**Requête MongoDB :**
```js
db.touristPOI.aggregate([
  {
    $lookup: {
      from: "velov2026",
      localField: "properties.address.streetAddress",
      foreignField: "address",
      as: "stationsMemesRue"
    }
  },
  { $match: { "stationsMemesRue.0": { $exists: true } } },
  {
    $project: {
      _id: 0,
      "properties.nom": 1,
      "properties.type": 1,
      "properties.address.streetAddress": 1,
      stationsMemesRue: { $slice: ["$stationsMemesRue", 2] }
    }
  }
])
```

**Résultat (exemple) :**
```json
{
    properties: {
      nom: 'Eurolines',
      type: 'COMMERCE_ET_SERVICE',
      address: { streetAddress: null }
    },
    stationsMemesRue: [
      {
        _id: ObjectId('69977d94118ba4e9946ec6f9'),
        number: 555,
        name: "0-555 - ATELIER VÉLO'V",
        bonus: false,
        bike_stands: 3,
        available_bike_stands: 0,
        available_bikes: 3,
        availabilitycode: 2,
        availability: 'Bleu',
        status: 'OPEN',
        banking: false,
        lat: 45.780403,
        lng: 4.904869,
        gid: 206,
        last_update: '2026-02-19T20:56:42.000+00:00',
        last_update_fme: '2026-02-19T21:04:41.101+00:00',
        overflow: false,
        total_stands: {
          capacity: 3,
          availabilities: {
            bikes: 3,
            stands: 0,
            electricalBikes: 2,
            mechanicalBikes: 1,
            electricalInternalBatteryBikes: 2,
            electricalRemovableBatteryBikes: 0
          }
        },
        main_stands: {
          capacity: 3,
          availabilities: {
            bikes: 3,
            stands: 0,
            electricalBikes: 2,
            mechanicalBikes: 1,
            electricalInternalBatteryBikes: 2,
            electricalRemovableBatteryBikes: 0
          }
        },
        geometry: { type: 'Point', coordinates: [ 4.904869, 45.780403 ] }
      },
      {
        _id: ObjectId('69977d94118ba4e9946ec7e5'),
        number: 10037,
        name: '10037 - DUPEUBLE / 8 MAI 1945',
        address_jcd: '40 RUE MICHEL DUPEUBLE\n69100 VILLEURBANNE',
        bonus: false,
        bike_stands: 15,
        available_bike_stands: 0,
        available_bikes: 0,
        availabilitycode: 0,
        availability: 'Gris',
        status: 'OPEN',
        banking: false,
        lat: 45.7760883668417,
        lng: 4.89227468095863,
        gid: 457,
        last_update_fme: '2026-02-19T21:04:41.081+00:00',
        overflow: false,
        total_stands: {
          capacity: 15,
          availabilities: {
            bikes: 0,
            stands: 0,
            electricalBikes: 0,
            mechanicalBikes: 0,
            electricalInternalBatteryBikes: 0,
            electricalRemovableBatteryBikes: 0
          }
        },
        main_stands: {
          capacity: 15,
          availabilities: {
            bikes: 0,
            stands: 0,
            electricalBikes: 0,
            mechanicalBikes: 0,
            electricalInternalBatteryBikes: 0,
            electricalRemovableBatteryBikes: 0
          }
        },
        geometry: { type: 'Point', coordinates: [ 4.892275, 45.776088 ] }
      }
    ]
  }
```

---

## Question 2.2 – $lookup par comparaison géographique

On crée d'abord un index `2dsphere` sur `touristPOI.geometry`. La distance entre chaque station Vélov' et les POI est calculée dans le pipeline du `$lookup` via une approximation planaire (1°lat ≈ 111 000 m, 1°lng ≈ 77 000 m à la latitude de Lyon), ce qui est suffisamment précis à cette échelle.

**Pour l'index :**
```js
db.touristPOI.createIndex({ "geometry": "2dsphere" })
```

**Lookup :**
```js
db.velov2026.aggregate([
  { $match: { commune: "Lyon 1er Arrondissement" } },
  { $limit: 5 },
  {
    $lookup: {
      from: "touristPOI",
      let: { lat: "$lat", lng: "$lng" },
      pipeline: [
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
                500
              ]
            }
          }
        },
        { $project: { _id: 0, "properties.nom": 1, "properties.type": 1 } }
      ],
      as: "poisProches"
    }
  },
  { $match: { "poisProches.0": { $exists: true } } },
  { $project: { name: 1, commune: 1, poisProches: { $slice: ["$poisProches", 3] } } }
])
```

**Résultat (exemple) :**
```json

{
  _id: ObjectId('69977d94118ba4e9946ec6af'),
  name: '1006- SUBSISTANCES',
  commune: 'Lyon 1er Arrondissement',
  poisProches: [
    {
      properties: { nom: 'Passerelle Saint Vincent', type: 'PATRIMOINE_CULTUREL' }
    },
    {
      properties: {
        nom: "Passerelle de l'Homme de la Roche",
        type: 'PATRIMOINE_CULTUREL'
      }
    },
    { properties: { nom: 'Salle Paul Garcin', type: 'EQUIPEMENT' } }
  ]
}

```

---

## Question 2.3 – Classement des communes par densité de restaurants autour des stations Vélov'

Pour chaque station, on compte les restaurants dans un rayon de 1 km via le même `$lookup` géographique. On groupe ensuite par commune pour calculer la moyenne par station, ce qui donne un indicateur de "richesse gastronomique" par arrondissement.

**Requête MongoDB :**
```js
db.velov2026.aggregate([
  {
    $lookup: {
      from: "touristPOI",
      let: { lat: "$lat", lng: "$lng" },
      pipeline: [
        { $match: { "properties.type": "RESTAURATION" } },
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
                1000
              ]
            }
          }
        }
      ],
      as: "restaurants"
    }
  },
  { $addFields: { nbRestaurants: { $size: "$restaurants" } } },
  {
    $group: {
      _id: "$commune",
      moyRestaurantsParStation: { $avg: "$nbRestaurants" },
      nbStations: { $sum: 1 }
    }
  },
  { $sort: { moyRestaurantsParStation: -1 } },
  { $limit: 5 }
])
```

Sans surprise, les arrondissements centraux (1er, 2ème) ressortent en tête, ce qui est cohérent avec la densité de restaurants dans ces zones.

---

## Question 3 – Application Web

### Bibliothèques utilisées
- **express** ^4.18 – serveur HTTP et routage
- **mongodb** ^6.3 – driver Node.js pour MongoDB

### Fichiers créés
- `server.js` – routes Express et connexion MongoDB
- `db.js` – module de connexion (connectToServer / getDb)
- `package.json` – dépendances
- `public/index.html` – interface utilisateur

### Guide de démarrage
```bash
npm install
node server.js
# Ouvrir http://localhost:3000
```
> **Prérequis :** MongoDB en cours d'exécution avec `touristPOI` et `velov2026` dans `20263IFMongoLab` et être sûr d'avoir fait `use 20263IFMongoLab` .

---

### Question 3.1 – Dropdown des communes Vélov'

La route `/api/communes` fait un `distinct("commune")` sur `velov2026` et renvoie la liste triée. Côté HTML, un `fetch` au chargement de la page remplit le `<select>`.

---

### Question 3.2 – Deux dropdowns + recherche + tableau imbriqué

Les deux dropdowns (communes et types de POI) sont chargés en parallèle via `Promise.all`. La recherche appelle `/api/search?commune=X&poiType=Y&range=500`, qui lance l'agrégation de la Q2.2 côté serveur. On ne retourne que les stations ayant au moins un POI correspondant, et le rendu HTML produit un tableau principal avec un sous-tableau de POI par ligne.

---

### Question 3.3 – Slider de distance

Un `<input type="range" min="0" max="1000" value="500">` remplace la constante 500 m. La valeur est passée en paramètre `range` à la route, qui l'injecte directement dans le calcul de distance de l'agrégation.

---

### Question 3.4 – Proposition de visualisation

On propose une carte Leaflet centrée sur Lyon où chaque station Vélov' est un `circleMarker` dont la couleur reflète le nombre de POI à proximité (vert → beaucoup, rouge → aucun). Un filtre par type de POI et un slider de distance permettent d'explorer les données dynamiquement. C'est une façon concrète de croiser les deux jeux de données et de voir quels quartiers combinent bien desserte vélo et offre touristique. En effet, on verra sur la carte apparaitre des points de différentes couleurs qui représentent les stations de vélo. Les couleurs de ces stations indiquent le nombre de points d'intérêt du type sélectionné qui sont dans le rayon choisi sur le slider. De plus, au survol de chaque station vélo, on affiche les fameux points d'intérêt alentours. Cette visualisation est accessible sur `http://localhost:3000/visualisation.html` .
Nous avons également tenté la visualisation classique proposée par le sujet qui est celle qui apparait au premier au lancement de la web app.