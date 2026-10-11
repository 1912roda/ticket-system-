import express from "express"
import sqlite3 from "sqlite3"
import session from "express-session";
import multer from "multer";
import path from "path";
import bcrypt from "bcrypt"; 
import "dotenv/config";


const app = express();
const port = 3000;
const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },

    filename: (req, file, cb) => {

        const dateiendung = path.extname(file.originalname);

        cb(
            null,
            Date.now() + "-" + file.fieldname + dateiendung
        );
    }

});

const upload = multer({
    storage: storage
});
app.use(express.static('public'));
app.use("/uploads", express.static("uploads"));

app.use(express.urlencoded({ extended: true }))
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

function nurAdmin(req, res, next) {

    if (req.session.rolle !== "admin") {
        return res.redirect("/login");
    }

    next();
}
function nurUser(req, res, next) {

    if (req.session.rolle !== "user") {
        return res.redirect("/login");
    }

    next();
}
const db = new sqlite3.Database("tickets.db");

db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titel TEXT NOT NULL,
        kategorie TEXT NOT NULL,
        prioritaet TEXT NOT NULL,
        status TEXT NOT NULL
    )
`);
db.run(`
    ALTER TABLE tickets
    ADD COLUMN beschreibung TEXT
`, (err) => {

    if (err) {
        console.log("beschreibung existiert wahrscheinlich schon");
    }

});
db.run(`
    ALTER TABLE tickets
    ADD COLUMN benutzer TEXT
`, (err) => {

    if (err) {
        console.log("benutzer existiert wahrscheinlich schon");
    }

});
db.run(`
    ALTER TABLE tickets
    ADD COLUMN erstellt_am TEXT
`, (err) => {

    if (err) {
        console.log("erstellt_am existiert wahrscheinlich schon");
    }

});
db.run(`
    ALTER TABLE tickets
    ADD COLUMN anhang TEXT
`, (err) => {

    if (err) {
        console.log("anhang existiert wahrscheinlich schon");
    }

});
db.run(`
    ALTER TABLE tickets
    ADD COLUMN admin_kommentar TEXT
`, (err) => {

    if (err) {
        console.log("admin_kommentar existiert wahrscheinlich schon");
    }

});
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        rolle TEXT NOT NULL
    )
`);



app.get("/admin",nurAdmin, (req, res) => {


    const status = req.query.status;
    const prioritaet = req.query.prioritaet;
    const suche = req.query.suche;

    db.all("SELECT * FROM tickets", (err, tickets) => {

        if (err) {
            console.log(err);
            return res.send("Fehler beim Laden");
        }

        let gefilterterTicket = tickets;

        if (status) {
            gefilterterTicket = gefilterterTicket.filter(
                ticket => ticket.status === status
            );
        }

        if (prioritaet) {
            gefilterterTicket = gefilterterTicket.filter(
                ticket => ticket.prioritaet === prioritaet
            );
        }

        if (suche) {
            gefilterterTicket = gefilterterTicket.filter(ticket =>
                ticket.titel.toLowerCase().includes(suche.toLowerCase()) ||
                ticket.kategorie.toLowerCase().includes(suche.toLowerCase())
            );
        }

        const reihenfolge = {
            Hoch: 1,
            Mittel: 2,
            Niedrig: 3
        };

        gefilterterTicket = [...gefilterterTicket].sort((a, b) => {
            return reihenfolge[a.prioritaet] - reihenfolge[b.prioritaet];
        });

        res.render("admin.ejs", {
            tickets: gefilterterTicket,
            status: status,
            prioritaet: prioritaet,
            suche: suche
        });

    }); // db.all ENDE

}); // /admin ENDE
app.get("/logout", (req, res) => {

    req.session.destroy(() => {
        res.redirect("/login");
    });

});

app.get("/user", nurUser, (req, res) => {

    db.all(
        "SELECT * FROM tickets WHERE benutzer = ?",
        [req.session.username],
        (err, tickets) => {

            if (err) {
                console.log(err);
                return res.send("Fehler beim Laden");
            }

            res.render("user.ejs", {
                tickets: tickets,
                username:req.session.username
            });

        }
    );

});
app.get("/login",(req,res)=>{
   res.render("login.ejs", {
   
});
})
app.get("/", (req, res) => {

    db.all("SELECT * FROM tickets", (err, tickets) => {

        if (err) {
            console.log(err);
            return res.send("Fehler beim Laden");
        }

        res.render("index.ejs", {
            tickets: tickets,
            status: "",
            prioritaet: "",
            suche: ""
        });

    });

});

app.get("/register", (req, res) => {
    res.render("register.ejs");
});
app.get("/tickets/:id", nurAdmin, (req, res) => {

    const id = Number(req.params.id);

    db.get(
        "SELECT * FROM tickets WHERE id = ?",
        [id],
        (err, ticket) => {

            if (err) {
                console.log(err);
                return res.send("Fehler beim Laden");
            }

            res.render("ticket.ejs", {
                ticket: ticket
            });
        }
    );

});
app.post("/register", async (req, res) => {

    const username = req.body.username;
    const password = req.body.password;

    const hashPasword= await bcrypt.hash(password,12);

    db.run(
        `INSERT INTO users (username, password, rolle)
         VALUES (?, ?, ?)`,
        [username, hashPasword, "user"],
        (err) => {

           if (err) {

    if (err.message.includes("UNIQUE")) {
        return res.send("Benutzername existiert bereits");
    }

    console.log(err.message);
    return res.send("Fehler bei der Registrierung");
}

            res.redirect("/login");
        }
    );

});
app.post("/tickets",nurUser,upload.single("anhang"), (req, res) => {

    console.log(req.body)
  
    console.log(req.file);



    const titel = req.body.titel;
    const kategorie = req.body.kategorie;
    const prioritaet = req.body.prioritaet;
    const beschreibung=req.body.beschreibung;
    const status = "neu";
    const benutzer = req.session.username;
    const erstellt_am = new Date().toLocaleString("de-DE");
    const anhang = req.file ? req.file.filename : null;

    db.run(`INSERT INTO tickets(titel,kategorie,beschreibung,prioritaet,status,benutzer,erstellt_am,anhang)

    VALUES(?,?,?,?,?,?,?,?)`, [titel, kategorie,beschreibung, prioritaet, status,benutzer,erstellt_am,anhang]


    );
    
    res.redirect("/user")

})



app.post("/tickets/:id/delete",nurAdmin, (req, res) => {
    const id = Number(req.params.id)

     db.run(
        `DELETE FROM tickets WHERE id = ?`,
        [id]
    );
    res.redirect("/admin")
}
)
app.post("/tickets/:id/status",nurAdmin, (req, res) => {
    const id = Number(req.params.id);
    const status = req.body.status;

    db.run(
        `UPDATE tickets
         SET status = ?
         WHERE id = ?`,
        [status, id]
    );
    res.redirect("/tickets/"+id)
}
)

app.post("/tickets/:id/titel",nurAdmin, (req, res) => {


     const id = Number(req.params.id);
    const titel = req.body.titel;

    db.run(
        `UPDATE tickets
         SET titel = ?
         WHERE id = ?`,
        [titel, id]
    );
    res.redirect("/tickets/"+id)

})

app.post("/login",async (req, res) => {

    const username = req.body.username;
    const password = req.body.password;
   

    db.get(
        `SELECT * FROM users
         WHERE username = ? `,
        [username,],
        
       async (err, user) => {
       

            if (err) {
                console.log(err);
                return res.send("Fehler bei der Anmeldung");
            }

            if (!user) {
                return res.render("login.ejs", {
                    fehler: "Falscher Benutzername oder Passwort"
                });
            }
            const passt=await bcrypt.compare(password,user.password);

            if(!passt){
               return res.render("login.ejs",{
                    fehler:"falsher Benutzername oder password"
                })
            }

            req.session.rolle = user.rolle;
            req.session.username = user.username;

            if (user.rolle === "admin") {
                return res.redirect("/admin");
            }

            if (user.rolle === "user") {
                return res.redirect("/user");
            }
        }
    );

});
app.post("/tickets/:id/kommentar", nurAdmin, (req, res) => {

    const id = Number(req.params.id);
    const admin_kommentar = req.body.admin_kommentar;

    db.run(
        `UPDATE tickets
         SET admin_kommentar = ?
         WHERE id = ?`,
        [admin_kommentar, id]
    );

    res.redirect("/tickets/" + id);
});

app.listen(port, () => {
    console.log("Seever ist runinng" + port);
})