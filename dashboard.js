// dashboard.js - Dashboard Simplificado
const express = require('express')
const app = express()
const PORT = process.env.PORT || 3002
const BOT_SERVICE = process.env.BOT_SERVICE || 'localhost:3001'

app.use(express.json())

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Financial Bot</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        .status {
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            font-weight: bold;
        }
        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }
        .qr_ready { background: #fff3cd; color: #856404; }
        .qr-code {
            margin: 20px 0;
            padding: 20px;
            border: 2px dashed #ddd;
            border-radius: 10px;
        }
        .qr-code img { max-width: 300px; height: auto; }
        .btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
            transition: background 0.3s;
        }
        .btn:hover { background: #0056b3; }
        .test-section {
            margin-top: 30px;
            padding: 20px;
            border: 1px solid #eee;
            border-radius: 10px;
            background: #f8f9fa;
        }
        .form-group { margin: 15px 0; text-align: left; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .form-group input, .form-group textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .response {
            margin-top: 15px;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
        }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 WhatsApp Financial Bot</h1>
        
        <div id="status" class="status disconnected">
            <div class="loading"></div> Verificando status...
        </div>
        
        <div id="qr-section" style="display: none;">
            <h3>📱 Conectar WhatsApp</h3>
            <p>1. Abra WhatsApp → Dispositivos conectados<br>
            2. Conectar um dispositivo<br>
            3. Escaneie o QR Code abaixo</p>
            
            <div class="qr-code">
                <div id="qr-loading">Carregando QR...</div>
                <img id="qr-image" style="display: none;" />
            </div>
        </div>
        
        <div id="connected-section" style="display: none;">
            <h2>✅ Conectado!</h2>
            <p>Bot ativo e funcionando</p>
            
            <div class="test-section">
                <h3>🧪 Teste</h3>
                <div class="form-group">
                    <label>Número:</label>
                    <input type="text" id="testNumber" placeholder="5511999999999" />
                </div>
                <div class="form-group">
                    <label>Mensagem:</label>
                    <textarea id="testMessage" rows="2">🤖 Teste do assistente!</textarea>
                </div>
                <button class="btn" onclick="sendTest()">Enviar</button>
                <div id="test-response"></div>
            </div>
        </div>
        
        <button class="btn" onclick="restart()">🔄 Reiniciar</button>
        <button class="btn" onclick="checkStatus()">📊 Atualizar</button>
    </div>

    <script>
        let interval;
        
        function checkStatus() {
            fetch('http://${BOT_SERVICE}/status')
                .then(r => r.json())
                .then(data => {
                    updateUI(data);
                })
                .catch(e => {
                    document.getElementById('status').innerHTML = '❌ Erro de conexão';
                    document.getElementById('status').className = 'status error';
                });
        }
        
        function updateUI(data) {
            const status = document.getElementById('status');
            const qrSection = document.getElementById('qr-section');
            const connectedSection = document.getElementById('connected-section');
            
            switch(data.status) {
                case 'connected':
                    status.innerHTML = '✅ WhatsApp Conectado';
                    status.className = 'status connected';
                    qrSection.style.display = 'none';
                    connectedSection.style.display = 'block';
                    break;
                    
                case 'qr_ready':
                    status.innerHTML = '📱 Escaneie o QR Code';
                    status.className = 'status qr_ready';
                    qrSection.style.display = 'block';
                    connectedSection.style.display = 'none';
                    loadQR();
                    break;
                    
                default:
                    status.innerHTML = '🔄 Conectando...';
                    status.className = 'status disconnected';
                    qrSection.style.display = 'none';
                    connectedSection.style.display = 'none';
            }
        }
        
        function loadQR() {
            fetch('http://${BOT_SERVICE}/qr')
                .then(r => r.json())
                .then(data => {
                    if (data.qr) {
                        document.getElementById('qr-loading').style.display = 'none';
                        document.getElementById('qr-image').src = data.qr;
                        document.getElementById('qr-image').style.display = 'block';
                    }
                })
                .catch(e => console.log('Erro QR:', e));
        }
        
        function restart() {
            fetch('http://${BOT_SERVICE}/restart', {method: 'POST'})
                .then(() => setTimeout(checkStatus, 2000))
                .catch(e => console.log('Erro restart:', e));
        }
        
        function sendTest() {
            const number = document.getElementById('testNumber').value;
            const message = document.getElementById('testMessage').value;
            const response = document.getElementById('test-response');
            
            if (!number || !message) {
                response.innerHTML = '<div class="response error">Preencha os campos!</div>';
                return;
            }
            
            fetch('http://${BOT_SERVICE}/send', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({to: number, message: message})
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    response.innerHTML = '<div class="response success">✅ Enviado!</div>';
                } else {
                    response.innerHTML = '<div class="response error">❌ ' + data.error + '</div>';
                }
            })
            .catch(e => {
                response.innerHTML = '<div class="response error">❌ ' + e.message + '</div>';
            });
        }
        
        // Auto-update
        checkStatus();
        interval = setInterval(checkStatus, 5000);
    </script>
</body>
</html>
    `)
})

app.listen(PORT, () => {
    console.log(`🌐 Dashboard: http://localhost:${PORT}`)
})
