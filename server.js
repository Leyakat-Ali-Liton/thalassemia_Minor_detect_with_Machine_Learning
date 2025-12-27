require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter; 

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public')); 

// --- Admin Authentication Configuration ---
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123"; 
let isAdminAuthenticated = false;

// -------------------- Page Routes --------------------

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin', (req, res) => {
    if (isAdminAuthenticated) {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.redirect('/admin-login');
    }
});

// -------------------- CSV Configuration --------------------
const csvWriter = createCsvWriter({
    path: process.env.HISTORY_CSV_PATH,
    header: [
        {id: 'id', title: 'User ID'},
        {id: 'age', title: 'Age'},
        {id: 'gender', title: 'Gender'},
        {id: 'hb', title: 'Hb'},
        {id: 'mcv', title: 'MCV'},
        {id: 'mch', title: 'MCH'},
        {id: 'rdw', title: 'RDW'},
        {id: 'rbc', title: 'RBC'},
        {id: 'fatigue', title: 'Fatigue'},
        {id: 'family_relation', title: 'Family Relation'},
        {id: 'jaundice', title: 'Jaundice'},
        {id: 'spleen', title: 'Spleen'},
        {id: 'mentzer', title: 'Mentzer'},
        {id: 'green_king', title: 'Green King'},
        {id: 'thal_res', title: 'Thalassemia Result'},
        {id: 'iron_res', title: 'Iron Result'}
    ],
    append: true
});

function getNextId() {
    try {
        const filePath = process.env.HISTORY_CSV_PATH;
        if (!fs.existsSync(filePath)) return 1;
        const data = fs.readFileSync(filePath, 'utf8').trim().split('\n');
        // Robust check for ID
        if (data.length <= 1) return 1;
        const lastRow = data[data.length - 1].split(',');
        const lastId = parseInt(lastRow[0]);
        return isNaN(lastId) ? 1 : lastId + 1;
    } catch (err) { return 1; }
}

// -------------------- API Routes --------------------

app.post('/api/admin-login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        isAdminAuthenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: "Incorrect password" });
    }
});

app.get('/api/admin-logout', (req, res) => {
    isAdminAuthenticated = false;
    res.redirect('/');
});

app.get('/api/stats', (req, res) => {
    try {
        const filePath = process.env.HISTORY_CSV_PATH;
        let stats = { thalNormal: 0, thalLikely: 0, thalPositive: 0, ironNormal: 0, ironDeficient: 0 };
        
        if (fs.existsSync(filePath)) {
            const rows = fs.readFileSync(filePath, 'utf8').trim().split('\n').slice(1);
            rows.forEach(row => {
                const cols = row.split(',');
                const thal = (cols[14] || "").toLowerCase();
                
                if (thal.includes("normal")) {
                    stats.thalNormal++;
                } else if (thal.includes("likely")) {
                    stats.thalLikely++;
                } else if (thal.includes("minor") || thal.includes("positive")) {
                    stats.thalPositive++;
                }

                const iron = (cols[15] || "").toLowerCase();
                if (iron.includes("no") || iron.includes("healthy") || iron.includes("normal")) {
                    stats.ironNormal++;
                } else {
                    stats.ironDeficient++;
                }
            });
        }
        res.json(stats);
    } catch (e) { 
        res.status(500).json({ error: "Stats error" }); 
    }
});

app.get('/api/logs', (req, res) => {
    if (!isAdminAuthenticated) return res.status(403).json({ error: "Unauthorized" });

    try {
        const filePath = process.env.HISTORY_CSV_PATH;
        if (!fs.existsSync(filePath)) return res.json([]);
        
        const data = fs.readFileSync(filePath, 'utf8').trim().split('\n');
        const limit = parseInt(req.query.limit) || 100;
        
        const rows = data.slice(1).reverse().slice(0, limit); 
        const logs = rows.map(row => {
            const cols = row.split(',');
            return {
                id: cols[0],
                age: cols[1],
                gender: cols[2],
                hb: cols[3],
                mcv: cols[4],
                mch: cols[5],
                rdw: cols[6],
                rbc: cols[7],
                mentzer: cols[12],
                thal_res: cols[14],
                iron_res: cols[15]
            };
        });
        res.json(logs);
    } catch (err) { res.status(500).json([]); }
});

app.get('/api/ml-metrics', (req, res) => {
    if (!isAdminAuthenticated) return res.status(403).json({ error: "Unauthorized" });

    const py = spawn(process.env.PYTHON_EXE, [process.env.METRICS_SCRIPT]);

    let dataString = "";
    py.stdout.on('data', (data) => dataString += data.toString());
    py.stderr.on('data', (data) => console.error(`Python Metrics Error: ${data}`));

    py.on('close', (code) => {
        if (code !== 0) return res.status(500).json({ error: "Metrics script failed" });
        try {
            res.json(JSON.parse(dataString));
        } catch (e) {
            res.status(500).json({ error: "Metrics parse error" });
        }
    });
});

app.post('/predict', (req, res) => {
    const d = req.body;
    // Correct spawn arguments to match predict.py expected order
    const py = spawn(process.env.PYTHON_EXE, [
        process.env.PREDICT_SCRIPT, 
        d.age, 
        d.gender, 
        d.hb, 
        d.mcv, 
        d.mch, 
        d.rdw, 
        d.rbc, 
        d.fatigue, 
        d.family_relation, 
        d.jaundice, 
        d.spleen
    ]);

    let resultData = "";
    py.stdout.on('data', (data) => resultData += data.toString());
    py.stderr.on('data', (data) => console.error(`Python Predict Error: ${data}`));
    
    py.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).json({ error: "Python script error" });
        }
        try {
            // Check for RAW output to debug parse errors
            const result = JSON.parse(resultData);
            
            if(result.error) {
                return res.status(400).json({ error: result.error });
            }

            result.id = getNextId();
            
            csvWriter.writeRecords([{
                id: result.id,
                age: d.age,
                gender: d.gender,
                hb: d.hb,
                mcv: d.mcv,
                mch: d.mch,
                rdw: d.rdw,
                rbc: d.rbc,
                fatigue: d.fatigue,
                family_relation: d.family_relation,
                jaundice: d.jaundice,
                spleen: d.spleen,
                mentzer: result.mentzer, 
                green_king: result.greenKing, 
                thal_res: result.thalassemia, 
                iron_res: result.iron
            }]);
            res.json(result);
        } catch (e) { 
            console.error("JSON Parse Error. Python output was:", resultData);
            res.status(500).json({ error: "Prediction parse error" }); 
        }
    });
});

app.listen(PORT, () => console.log(`🚀 JIBON Server running at http://localhost:${PORT}`));