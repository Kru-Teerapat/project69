const GOOGLE_SHEET_JSONP_URL = 'https://docs.google.com/spreadsheets/d/1BvwzFmQLEuN7wOzXejI0xrNgCZgRK1r4npVEJ_sjXOw/gviz/tq?tqx=out:json;responseHandler:processGoogleSheetData';

// DOM Elements
const loadingState = document.getElementById('loading-state');
const dashboardContent = document.getElementById('dashboard-content');
const refreshBtn = document.getElementById('refresh-btn');
const lastUpdateEl = document.getElementById('last-update');

// Summary Cards
const totalProjectsEl = document.getElementById('total-projects');
const totalBudgetEl = document.getElementById('total-budget');
const totalUsedEl = document.getElementById('total-used');
const totalRemainingEl = document.getElementById('total-remaining');

// Table
const projectTableBody = document.querySelector('#project-table tbody');
const searchInput = document.getElementById('search-input');

// Chart instances
let statusChartInstance = null;
let deptChartInstance = null;
let allData = [];

// Format currency
const formatCurrency = (amount) => {
    if (isNaN(amount) || amount === null || amount === '') return '฿0';
    return '฿' + parseFloat(amount).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// Map status to css class
const getStatusClass = (status) => {
    if (status.includes('ดำเนินการแล้ว') || status === '100') return 'status-done';
    if (status.includes('ยังไม่ดำเนินการ') || status === '0') return 'status-notstarted';
    return 'status-progress';
};

// Fetch data using JSONP to avoid CORS and file:// protocol issues
const fetchData = () => {
    // Show loading
    loadingState.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
    
    // Create a script tag dynamically
    const script = document.createElement('script');
    // Add cache buster
    script.src = `${GOOGLE_SHEET_JSONP_URL}&_=${new Date().getTime()}`;
    script.id = 'google-sheet-script';
    
    // Error handling
    script.onerror = () => {
        console.error("Error fetching data via JSONP");
        alert("ไม่สามารถเชื่อมต่อกับ Google Sheet ได้ กรุณาตรวจสอบอินเทอร์เน็ต");
        loadingState.innerHTML = '<p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    };

    // Remove old script if exists
    const oldScript = document.getElementById('google-sheet-script');
    if (oldScript) {
        document.body.removeChild(oldScript);
    }
    
    // Append to body to trigger request
    document.body.appendChild(script);
};

// This function is called by the Google Sheet JSONP response
window.processGoogleSheetData = (response) => {
    if (response.status === 'error') {
        alert("Error: " + response.errors[0].message);
        return;
    }

    const cols = response.table.cols.map(c => c.label);
    const rows = response.table.rows;
    
    // Convert Google Visualization JSON to simple object array
    allData = rows.map(row => {
        const item = {};
        row.c.forEach((cell, index) => {
            const columnName = cols[index];
            item[columnName] = cell ? (cell.v !== null ? cell.v : '') : '';
        });
        return item;
    });

    processData(allData);
    
    // Hide loading
    loadingState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    
    // Update time
    const now = new Date();
    lastUpdateEl.innerHTML = `<i class="fa-solid fa-clock"></i> ${now.toLocaleTimeString('th-TH')}`;
};

const processData = (data) => {
    let totalProjects = data.length;
    let totalBudget = 0;
    let totalUsed = 0;
    
    const statusCounts = {};
    const deptBudget = {};

    data.forEach(row => {
        // Parse numbers safely
        const budget = parseFloat(row['งบประมาณ']) || 0;
        const used = parseFloat(row['ใช้ไปแล้ว']) || 0;
        
        totalBudget += budget;
        totalUsed += used;

        // Count status
        const status = row['สถานะ'] || 'ไม่ระบุ';
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        // Group by department
        const dept = row['กลุ่มงาน'] || 'ไม่ระบุ';
        deptBudget[dept] = (deptBudget[dept] || 0) + budget;
    });

    const totalRemaining = totalBudget - totalUsed;

    // Update Summary Cards
    totalProjectsEl.textContent = totalProjects;
    totalBudgetEl.textContent = formatCurrency(totalBudget);
    totalUsedEl.textContent = formatCurrency(totalUsed);
    totalRemainingEl.textContent = formatCurrency(totalRemaining);

    // Update Charts
    updateCharts(statusCounts, deptBudget);

    // Render Table
    renderTable(data);
};

const updateCharts = (statusCounts, deptBudget) => {
    // Colors
    const colors = ['#4361ee', '#06d6a0', '#f72585', '#4cc9f0', '#fca311'];

    // Status Chart
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    if (statusChartInstance) statusChartInstance.destroy();
    
    statusChartInstance = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            },
            cutout: '70%'
        }
    });

    // Department Chart
    const deptCtx = document.getElementById('departmentChart').getContext('2d');
    if (deptChartInstance) deptChartInstance.destroy();

    deptChartInstance = new Chart(deptCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(deptBudget),
            datasets: [{
                label: 'งบประมาณ (บาท)',
                data: Object.values(deptBudget),
                backgroundColor: 'rgba(67, 97, 238, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
};

const renderTable = (data) => {
    projectTableBody.innerHTML = '';
    
    data.forEach(row => {
        const tr = document.createElement('tr');
        
        const progressValue = parseFloat(row['ความคืบหน้า']) || 0;
        const remainingValue = (parseFloat(row['งบประมาณ']) || 0) - (parseFloat(row['ใช้ไปแล้ว']) || 0);

        tr.innerHTML = `
            <td><strong>${row['ชื่อโครงการ'] || '-'}</strong></td>
            <td>${row['ผู้รับผิดชอบ'] || '-'}</td>
            <td>${row['กลุ่มงาน'] || '-'}</td>
            <td>${formatCurrency(row['งบประมาณ'])}</td>
            <td>${formatCurrency(row['ใช้ไปแล้ว'])}</td>
            <td>${formatCurrency(remainingValue)}</td>
            <td>
                <div>${progressValue.toFixed(2)}%</div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${progressValue}%"></div>
                </div>
            </td>
            <td><span class="status-badge ${getStatusClass(row['สถานะ'])}">${row['สถานะ'] || '-'}</span></td>
        `;
        projectTableBody.appendChild(tr);
    });
};

// Event Listeners
refreshBtn.addEventListener('click', fetchData);

searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredData = allData.filter(row => 
        (row['ชื่อโครงการ'] || '').toLowerCase().includes(searchTerm) ||
        (row['ผู้รับผิดชอบ'] || '').toLowerCase().includes(searchTerm) ||
        (row['กลุ่มงาน'] || '').toLowerCase().includes(searchTerm)
    );
    renderTable(filteredData);
});

// Initialize
fetchData();
