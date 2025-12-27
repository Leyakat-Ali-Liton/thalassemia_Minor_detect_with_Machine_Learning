document.addEventListener('DOMContentLoaded', updateCharts);

function scrollToSection(id) {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
}

// Logic to fetch CSV stats and render Donut Graphs
async function updateCharts() {
    const response = await fetch('/api/stats');
    const stats = await response.json();

    const chartConfig = (id, labels, data, colors) => {
        const canvas = document.getElementById(id);
        if (window[id + 'Chart']) window[id + 'Chart'].destroy(); // Clear old chart
        window[id + 'Chart'] = new Chart(canvas, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: data, backgroundColor: colors }] }
        });
    };

    chartConfig('thalDonut', ['Normal', 'Positive'], [stats.thalNormal, stats.thalPositive], ['#198754', '#dc3545']);
    chartConfig('ironDonut', ['Healthy', 'Deficient'], [stats.ironNormal, stats.ironDeficient], ['#0dcaf0', '#fd7e14']);
}

document.getElementById('familyHistory').addEventListener('change', function() {
    document.getElementById('relationContainer').classList.toggle('d-none', this.value === 'No');
});

document.getElementById('predictionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const rawData = Object.fromEntries(formData.entries());

    const payload = {
        age: parseInt(rawData.age), gender: rawData.gender,
        hb: parseFloat(rawData.hb), mcv: parseFloat(rawData.mcv),
        mch: parseFloat(rawData.mch), rdw: parseFloat(rawData.rdw), rbc: parseFloat(rawData.rbc),
        fatigue: parseInt(rawData.fatigue),
        family_relation: rawData.familyHistory === "Yes" ? parseInt(rawData.relation) : 0,
        jaundice: document.getElementById('jaundice').checked ? 1 : 0,
        spleen: document.getElementById('spleen').checked ? 1 : 0
    };

    const res = await fetch('/predict', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
    });
    
    const result = await res.json();
    displayResults(result);
});

function displayResults(result) {
    document.getElementById('resultSection').style.display = 'block';
    
    // Set Values
    document.getElementById('thalResultText').innerText = result.thalassemia;
    document.getElementById('thalResultText').style.color = result.thalColor;
    document.getElementById('ironResultText').innerText = result.iron;
    document.getElementById('ironResultText').style.color = result.ironColor;
    document.getElementById('mentzerVal').innerText = result.mentzer;
    document.getElementById('greenKingVal').innerText = result.greenKing;
    document.getElementById('patientId').innerText = "System ID: " + result.id;

    // Thalassemia Advice
    const thalAdv = document.getElementById('thalAdvice');
    thalAdv.classList.remove('d-none');
    if (result.thalassemia.includes("Likely")) {
        thalAdv.className = "advice-box alert alert-danger";
        thalAdv.innerText = "🚨 Advice: High risk detected. Please consult a hematologist for Hb Electrophoresis.";
    } else {
        thalAdv.className = "advice-box alert alert-success";
        thalAdv.innerText = "✅ Normal: Maintain a balanced diet and regular screening.";
    }

    // Iron Advice
    const ironAdv = document.getElementById('ironAdvice');
    ironAdv.classList.remove('d-none');
    if (result.iron.includes("Deficiency")) {
        ironAdv.className = "advice-box alert alert-warning";
        ironAdv.innerText = "💡 Suggestion: Low iron detected. Consider iron-rich foods (lean meats, leafy greens).";
    } else {
        ironAdv.className = "advice-box alert alert-success";
        ironAdv.innerText = "✅ Healthy iron levels detected.";
    }

    updateCharts(); // Refresh graphs after new test
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
}