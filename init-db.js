const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const saltRounds = 10;

// Créer ou ouvrir la base de données SQLite
const db = new sqlite3.Database('./db.sqlite', (err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err.message);
  } else {
    console.log('Connexion à la base de données SQLite réussie.');
  }
});

// Créer ou mettre à jour la table 'stats' pour inclure les nouvelles colonnes
db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        map TEXT NOT NULL,
        winnerFaction TEXT NOT NULL,
        loserFaction TEXT NOT NULL,
        ticketDiff INTEGER NOT NULL,
        gameMode TEXT NOT NULL,
        winnerBattalion TEXT,
        loserBattalion TEXT,
        winnerCategory TEXT,
        loserCategory TEXT,
        gameDate TEXT NOT NULL  -- Ajouter cette ligne pour la date
      )
    `, (err) => {
      if (err) {
        console.error('Erreur lors de la création de la table:', err.message);
      } else {
        console.log('Table "stats" mise à jour avec succès');
      }
    });
  });
  

// Créer la table 'users' si elle n'existe pas déjà
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('Erreur lors de la création de la table des utilisateurs:', err.message);
    } else {
      console.log('Table "users" créée avec succès');
    }
  });
});

// Ajouter l'utilisateur "wagon2neige" s'il n'existe pas
db.get('SELECT * FROM users WHERE username = ?', ['wagon2neige'], (err, row) => {
  if (err) {
    console.error('Erreur de vérification de l\'utilisateur:', err);
  }
  if (!row) {
    // Si l'utilisateur n'existe pas, on le crée avec un mot de passe haché
    bcrypt.hash('Snowplouklepgm156', saltRounds, (err, hash) => {
      if (err) {
        console.error('Erreur de hachage du mot de passe:', err);
        return;
      }

      const query = 'INSERT INTO users (username, password_hash) VALUES (?, ?)';
      db.run(query, ['wagon2neige', hash], function(err) {
        if (err) {
          console.error('Erreur lors de l\'ajout de l\'utilisateur:', err.message);
        } else {
          console.log('Utilisateur "wagon2neige" ajouté avec succès !');
        }
      });
    });
  } else {
    console.log('L\'utilisateur "wagon2neige" existe déjà.');
  }
});

// Fonction pour insérer les données de jeu dans la base de données
const insertGameData = (gameData) => {
    const { map, winnerFaction, loserFaction, ticketDiff, gameMode, winnerBattalion, loserBattalion, winnerCategory, loserCategory } = gameData;
    
    // Récupérer la date actuelle en format ISO
    const gameDate = new Date().toISOString();  // Format: "2024-11-24T14:45:30.000Z"
  
    const query = `
      INSERT INTO stats (map, winnerFaction, loserFaction, ticketDiff, gameMode, winnerBattalion, loserBattalion, winnerCategory, loserCategory, gameDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [map, winnerFaction, loserFaction, ticketDiff, gameMode, winnerBattalion, loserBattalion, winnerCategory, loserCategory, gameDate], function(err) {
      if (err) {
        console.error('Erreur lors de l\'ajout des données de jeu:', err.message);
      } else {
        console.log('Partie ajoutée avec succès !');
      }
    });
  };

// Exemple d'utilisation avec un objet de données de jeu
const gameData = {
  map: 'Erangel',
  winnerFaction: 'USA',
  loserFaction: 'PLA',
  ticketDiff: 100,
  gameMode: 'Battle Royale',
  winnerBattalion: '1st Cavalry Regiment',    // Exemple de bataillon gagnant
  loserBattalion: '195th Heavy Combined Arms Brigade', // Exemple de bataillon perdant
  winnerCategory: 'Armored',                    // Exemple de catégorie gagnante
  loserCategory: 'Mechanized'                   // Exemple de catégorie perdante
};

// Insérer les données de jeu dans la base de données
insertGameData(gameData);

// Fermer la base de données après la création des tables et l'insertion des données
db.close((err) => {
  if (err) {
    console.error('Erreur lors de la fermeture de la base de données:', err.message);
  } else {
    console.log('Base de données fermée.');
  }
});
