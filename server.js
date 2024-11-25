const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const session = require('express-session');

// Créer une instance d'Express
const app = express();

// Middleware pour parser le corps de la requête
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Utilisation de sessions
app.use(session({
  secret: 'votre_secret', 
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Créer et ouvrir la base de données SQLite
const db = new sqlite3.Database('./db.sqlite', (err) => {
  if (err) {
    console.error('Erreur lors de l\'ouverture de la base de données:', err.message);
  } else {
    console.log('Connexion à la base de données SQLite réussie');
  }
});

// Créer la table 'stats' si elle n'existe pas
db.run(`
  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    map TEXT NOT NULL,
    winnerFaction TEXT NOT NULL,
    loserFaction TEXT NOT NULL,
    ticketDiff INTEGER NOT NULL,
    gameMode TEXT NOT NULL,
    winnerBattalion TEXT NOT NULL,
    loserBattalion TEXT NOT NULL,
    winnerCategory TEXT,
    loserCategory TEXT,
    gameDate TEXT NOT NULL  
  )
`, (err) => {
  if (err) {
    console.error('Erreur lors de la création de la table stats:', err.message);
  } else {
    console.log('Table "stats" créée avec succès');
  }

  
});


// Serveur qui sert les fichiers statiques (comme admin.html)
app.use(express.static(path.join(__dirname, 'public')));

// Route POST pour la connexion admin
app.post('/admin', (req, res) => {
  const { username, password } = req.body;

  // Vérifier l'existence de l'utilisateur dans la base de données
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error('Erreur lors de la vérification de l\'utilisateur:', err);
      return res.status(500).send('Erreur interne du serveur');
    }

    // Si l'utilisateur existe, vérifier le mot de passe
    if (row) {
      bcrypt.compare(password, row.password_hash, (err, result) => {
        if (err) {
          console.error('Erreur lors de la comparaison des mots de passe:', err);
          return res.status(500).send('Erreur interne du serveur');
        }

        if (result) {
          // Si les informations sont correctes, établir la session et rediriger vers admin.html
          req.session.loggedIn = true;
          res.redirect('/admin.html');
        } else {
          // Sinon, afficher un message d'erreur
          res.send('<p>Nom d\'utilisateur ou mot de passe incorrect.</p><a href="/login.html">Retour</a>');
        }
      });
    } else {
      res.send('<p>Nom d\'utilisateur ou mot de passe incorrect.</p><a href="/login.html">Retour</a>');
    }
  });
});

// Middleware pour vérifier si l'utilisateur est connecté
function checkAdmin(req, res, next) {
  if (!req.session.loggedIn) {
    return res.redirect('/login.html');  // Redirige vers la page de connexion si non connecté
  }
  next();  // Sinon, continue avec la requête
}

// Route POST pour ajouter une partie (accessible uniquement si admin est connecté)
app.post('/add-game', checkAdmin, (req, res) => {
    const { map, winner, loser, tickets, mode, winnerBattalion, loserBattalion, winnerCategory, loserCategory, entryDateTime } = req.body;
  
    // Vérifiez et convertissez la date si nécessaire
    const gameDate = entryDateTime ? new Date(entryDateTime).toISOString() : new Date().toISOString();  // Si la date n'est pas fournie, utilisez la date actuelle
  
    // Insertion des données dans la base de données
    const query = `
      INSERT INTO stats (map, winnerFaction, loserFaction, ticketDiff, gameMode, winnerBattalion, loserBattalion, winnerCategory, loserCategory, gameDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
  
    db.run(query, [map, winner, loser, tickets, mode, winnerBattalion, loserBattalion, winnerCategory, loserCategory, gameDate], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).send('Erreur lors de l\'ajout des données');
      }
      res.redirect('/admin.html');  // Rediriger vers la page d'administration après l'ajout des données
    });
  });
  

// Route GET pour récupérer toutes les parties
app.get('/api/games', (req, res) => {
  const query = 'SELECT * FROM stats'; // Sélectionner toutes les parties
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('Erreur lors de la récupération des données');
    }
    res.json(rows); // Renvoie les résultats sous forme de JSON
  });
});

// Ajouter un utilisateur par défaut s'il n'existe pas déjà
const defaultUsername = 'wagon2neige';
const defaultPassword = 'Snowplouklepgm156';

db.get('SELECT * FROM users WHERE username = ?', [defaultUsername], (err, row) => {
  if (err) {
    console.error('Erreur de vérification de l\'utilisateur:', err);
  }
  if (!row) {
    // Si l'utilisateur n'existe pas, on l'ajoute avec un mot de passe haché
    bcrypt.hash(defaultPassword, saltRounds, (err, hash) => {
      if (err) {
        console.error('Erreur de hachage du mot de passe:', err);
        return;
      }

      // Insertion dans la base de données
      const query = 'INSERT INTO users (username, password_hash) VALUES (?, ?)';
      db.run(query, [defaultUsername, hash], function(err) {
        if (err) {
          console.error('Erreur lors de l\'ajout de l\'utilisateur:', err.message);
        } else {
          console.log(`Utilisateur "${defaultUsername}" ajouté avec succès !`);
        }
      });
    });
  } else {
    console.log('L\'utilisateur "wagon2neige" existe déjà.');
  }
});
app.delete('/api/games/:id', (req, res) => {
  const gameId = req.params.id;

  // Define the delete query
  const query = 'DELETE FROM stats WHERE id = ?';

  // Run the delete query
  db.run(query, [gameId], function(err) {
    if (err) {
      console.error('Erreur lors de la suppression du jeu:', err.message);
      return res.status(500).send('Erreur lors de la suppression du jeu.');
    }

    if (this.changes === 0) {
      // If no rows were deleted
      return res.status(404).send('Jeu non trouvé.');
    }

    res.status(200).send('Jeu supprimé avec succès.');
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});
