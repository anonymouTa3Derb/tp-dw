# CR TP Noté – Données pour le Web

**ESSAKI Mehdi – CHALMIN Lola**  
**20231511 – 20250952**

---

## Question 1.1 – Simplification de la collection `touristPOI_c`

**Approche :** Le fichier JSON importé est un GeoJSON FeatureCollection. MongoDB le stocke comme **un seul document** dans `touristPOI_c`, avec un tableau `features` contenant tous les POI. Pour extraire chaque feature en document indépendant dans `touristPOI`, on utilise `$unwind` (pour dérouler le tableau) puis `$replaceRoot` (pour faire remonter chaque feature à la racine), et enfin `$out` pour écrire dans la nouvelle collection.

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

**Approche :** Le champ `theme` est un tableau de chaînes. On `$unwind` ce tableau pour avoir une ligne par thème, puis on groupe par type en collectant les thèmes distincts avec `$addToSet`. On calcule le nombre de thèmes distincts avec `$size` et on trie de manière décroissante.

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

**5 premiers résultats (exemple) :**
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

**Approche :** On joint `touristPOI` et `velov2026` en cherchant une correspondance exacte entre `address.streetAddress` (POI) et `address` (Vélov'). Les correspondances exactes sont rares, mais la requête démontre le principe du $lookup sur un champ textuel.

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
  "properties": {
    "nom": "Gare Part-Dieu",
    "type": "EQUIPEMENT",
    "address": { "streetAddress": "5 Place Charles Béraudier" }
  },
  "stationsMemesRue": [{ "name": "Station Béraudier", "commune": "Lyon 3ème Arrondissement" }]
}
```

---

## Question 2.2 – $lookup par comparaison géographique

**Approche :** On crée un index 2dsphere sur `touristPOI.geometry`. Ensuite on utilise un `$lookup` avec pipeline qui calcule la distance approximative en mètres entre les coordonnées de chaque station Vélov' et les POI (approximation planaire : 1°lat ≈ 111 000 m, 1°lng ≈ 77 000 m à Lyon ~45.75°N). On filtre les POI dans un rayon de 500 m.

**Création de l'index :**
```js
db.touristPOI.createIndex({ "geometry": "2dsphere" })
```

**Requête MongoDB :**
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
  "name": "Hôtel de Ville - Louis Pradel",
  "commune": "Lyon 1er Arrondissement",
  "poisProches": [
    { "properties": { "nom": "Brasserie Georges", "type": "RESTAURATION" } },
    { "properties": { "nom": "Opéra de Lyon", "type": "PATRIMOINE_CULTUREL" } }
  ]
}
```

---

## Question 2.3 – Requête créative : classement des communes par densité de restaurants à proximité des stations Vélov'

**Idée :** Pour chaque station Vélov', compter les restaurants dans un rayon de 1 km. Grouper par commune et calculer la moyenne de restaurants par station — score de "richesse gastronomique" par commune.

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

**Interprétation :** Ce résultat montre quelles communes lyonnaises offrent le meilleur accès combiné vélo + restauration — utile pour un visiteur qui se déplace à vélo.

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
> **Prérequis :** MongoDB en cours d'exécution avec `touristPOI` et `velov2026` dans `20263IFMongoLab`.

---

### Question 3.1 – Dropdown des communes Vélov'

Route Express `/api/communes` : appelle `db.collection("velov2026").distinct("commune")` et renvoie la liste triée en JSON. Le HTML initialise le `<select id="commune">` avec cette liste au chargement de la page (`fetch('/api/communes')`).

---

### Question 3.2 – Deux dropdowns + recherche + tableau imbriqué

La page charge en parallèle les communes (Vélov') et les types de POI (`touristPOI`) via `Promise.all`. Le bouton "Rechercher" appelle `/api/search?commune=X&poiType=Y&range=500`.

La route Express utilise une agrégation `$lookup` (voir Q2.2) pour trouver les stations Vélov' de la commune ayant au moins un POI du type demandé dans le rayon. Le résultat est rendu en tableau HTML avec un **sous-tableau** par ligne listant les POI (nom, thème(s), adresse).

---

### Question 3.3 – Slider de distance (0–1000 m)

Un `<input type="range" min="0" max="1000" value="500">` remplace la constante 500 m. Sa valeur est affichée en temps réel (`oninput`) et transmise comme paramètre `range` à `/api/search`. Côté serveur, `parseFloat(req.query.range) || 500` l'intègre dans le calcul de distance de l'agrégation.

---

### Question 3.4 – Proposition de visualisation

**Idée : carte de Lyon avec les stations Vélov' colorées selon la densité de POI à proximité**

On afficherait une carte Leaflet.js avec :
- Un `<select>` pour le type de POI et un slider pour la distance
- Chaque station Vélov' comme un `circleMarker` dont la **couleur** indique le nombre de POI à proximité (vert = beaucoup, orange = peu, rouge = aucun)
- Un clic sur une station affiche la liste des POI dans un popup

**Données :** coordonnées Vélov' (`lat`, `lng`) + résultat de la jointure géographique Q2.2 côté serveur.

**Intérêt :** visualiser quelles zones de Lyon combinent le mieux accessibilité vélo et richesse touristique — outil utile pour visiteurs et office du tourisme.
