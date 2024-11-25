const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
require('dotenv').config();

const app = express();
const saltRounds = 10;

// Middleware to parse request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 2, // 2 hours
    },
  })
);

// Serve static files (index.html, graph.html, styles.css, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Database setup (SQLite)
const db = new sqlite3.Database('./db.sqlite', (err) => {
  if (err) {
    console.error('Erreur lors de l\'ouverture de la base de données:', err.message);
  } else {
    console.log('Connexion à la base de données SQLite réussie');
  }
});

// Ensure the 'users' table exists (for admin credentials)
db.run(
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  )`,
  (err) => {
    if (err) {
      console.error('Erreur lors de la création de la table users:', err.message);
    } else {
      console.log('Table "users" créée avec succès');
    }
  }
);

// Add a default admin user if not exists
const defaultUsername = process.env.ADMIN_USERNAME || 'wagon2neige';
const defaultPassword = process.env.ADMIN_PASSWORD || 'Snowplouklepgm156';

db.get('SELECT * FROM users WHERE username = ?', [defaultUsername], (err, row) => {
  if (err) {
    console.error('Erreur lors de la vérification de l\'utilisateur admin:', err);
  }
  if (!row) {
    bcrypt.hash(defaultPassword, saltRounds, (err, hash) => {
      if (err) {
        console.error('Erreur de hachage du mot de passe:', err);
        return;
      }

      const query = 'INSERT INTO users (username, password_hash) VALUES (?, ?)';
      db.run(query, [defaultUsername, hash], (err) => {
        if (err) {
          console.error('Erreur lors de l\'ajout de l\'utilisateur admin:', err.message);
        } else {
          console.log(`Utilisateur admin "${defaultUsername}" ajouté avec succès.`);
        }
      });
    });
  } else {
    console.log('L\'utilisateur admin existe déjà.');
  }
});

// Middleware to check if the user is logged in
function checkAdmin(req, res, next) {
  if (!req.session.loggedIn) {
    return res.redirect('/login'); // Redirect to login if not logged in
  }
  next();
}

// Routes

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve login.html
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.delete('/api/games/:id', checkAdmin, (req, res) => {
  const gameId = req.params.id;

  if (!gameId) {
    return res.status(400).json({ message: 'ID de partie manquant' });
  }

  const query = 'DELETE FROM stats WHERE id = ?';

  db.run(query, [gameId], function (err) {
    if (err) {
      console.error('Erreur lors de la suppression du jeu:', err.message);
      return res.status(500).json({ message: 'Erreur lors de la suppression du jeu' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: 'Partie non trouvée' });
    }

    res.status(200).json({ message: 'Partie supprimée avec succès' });
  });
});
// Handle login submission
app.post('/admin', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error('Erreur lors de la vérification de l\'utilisateur:', err);
      return res.status(500).send('Erreur interne du serveur');
    }

    if (row) {
      bcrypt.compare(password, row.password_hash, (err, result) => {
        if (err) {
          console.error('Erreur lors de la comparaison des mots de passe:', err);
          return res.status(500).send('Erreur interne du serveur');
        }

        if (result) {
          req.session.loggedIn = true;
          res.redirect('/admin.html');
        } else {
          res.status(401).send('Nom d\'utilisateur ou mot de passe incorrect.');
        }
      });
    } else {
      res.status(401).send('Nom d\'utilisateur ou mot de passe incorrect.');
    }
  });
});

// Protect admin.html
app.get('/admin.html', checkAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fetch game stats (admin only)
app.get('/api/games', checkAdmin, (req, res) => {
  const query = 'SELECT * FROM stats';
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ message: 'Erreur lors de la récupération des données' });
    }
    res.json(rows);
  });
});

// Add new game stats (admin only)
app.post('/add-game', checkAdmin, (req, res) => {
  const { map, winner, loser, tickets, mode, winnerBattalion, loserBattalion, entryDateTime } = req.body;

  if (!map || !winner || !loser || !tickets || !mode || !winnerBattalion || !loserBattalion || !entryDateTime) {
    return res.status(400).json({ message: 'Paramètres manquants' });
  }

  const gameDate = new Date(entryDateTime).toISOString();

  const query = `
    INSERT INTO stats (map, winnerFaction, loserFaction, ticketDiff, gameMode, winnerBattalion, loserBattalion, gameDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [map, winner, loser, tickets, mode, winnerBattalion, loserBattalion, gameDate], (err) => {
    if (err) {
      console.error('Erreur lors de l\'ajout des données:', err);
      return res.status(500).json({ message: 'Erreur lors de l\'ajout des données' });
    }
    res.status(201).json({ message: 'Partie ajoutée avec succès' });
  });
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Erreur lors de la déconnexion:', err);
      return res.status(500).send('Erreur lors de la déconnexion.');
    }
    res.redirect('/login');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});
