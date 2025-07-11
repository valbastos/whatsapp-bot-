// dashboard.js - Interface Web para ver QR Code
const express = require('express')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3002
const BOT_SERVICE = process.env.BOT_SERVICE || 'localhost:3001'

app.use(express.static('public'))
app.use(express.json())

// Página principal
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Financial Assistant</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
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
        .qr-code img {
            max-width: 300px;
            height: auto;
        }
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
        .btn:disabled { 
            background: #ccc; 
            cursor: not-allowed; 
        }
        .test-section {
            margin-top: 30px;
            padding: 20px;
            border: 1px solid #eee;
            border-radius: 10px;
            background: #f8f9fa;
        }
        .form-group {
            margin: 15px 0;
            text-align: left;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .form-group input, .form-group textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
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
        .emoji { font-size: 2em; margin: 10px 0; }
        .instructions {
            text-align: left;
            background: #e3f2fd;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .instructions ol {
            margin: 0;
            padding-left: 20px;
        }
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
        <h1>🤖 Assistente Financeiro WhatsApp</h1>
        
        <div id="status" class="status disconnected">
            <div class="loading"></div> Carregando status...
        </div>
        
        <div id="qr-section" style="display: none;">
            <div class="instructions">
                <strong>📱 Como conectar seu WhatsApp:</strong>
                <ol>
                    <li>Abra o WhatsApp no seu celular</li>
                    <li>Toque nos três pontos (⋮) → <strong>Dispositivos conectados</strong></li>
                    <li>Toque em <strong>"Conectar um dispositivo"</strong></li>
                    <li>Escaneie o QR Code abaixo</li>
                </ol>
            </div>
            
            <div class="qr-code">
                <div id="qr-loading">
                    <div class="loading"></div>
                    <p>Gerando QR Code...</p>
                </div>
                <img id="qr-image" style="display: none;" />
            </div>
            
            <button class="btn" onclick="refreshQR()">🔄 Atualizar QR Code</button>
        </div>
        
        <div id="connected-section" style="display: none;">
            <div class="emoji">✅</div>
            <h2>WhatsApp Conectado!</h2>
            <p>Seu assistente financeiro está ativo e pronto para receber mensagens.</p>
            
            <div class="test-section">
                <h3>🧪 Testar Envio de Mensagem</h3>
                <div class="form-group">
                    <label>Número (com código do país):</label>
                    <input type="text" id="testNumber" placeholder="5511999999999" />
                </div>
                <div class="form-group">
                    <label>Mensagem:</label>
                    <textarea id="testMessage" rows="3" placeholder="🤖 Olá! Sou seu assistente financeiro sarcástico!">🤖 Olá! Sou seu assistente financeiro sarcástico!</textarea>
                </div>
                <button class="btn" onclick="sendTestMessage()">📤 Enviar Teste</button>
                <div id="test-response"></div>
            </div>
        </div>
        
        <div style="margin-top: 30px;">
            <button class="btn" onclick="restartConnection()">🔄 Reiniciar Conexão</button>
            <button class="btn" onclick="checkStatus()">📊 Atualizar Status</button>
        </div>
        
        <div style="margin-top: 20px; font-size: 14px; color: #666;">
            <p><strong>URL do N8N:</strong> ${process.env.N8N_WEBHOOK_URL || 'Não configurado'}</p>
            <p><strong>Status da API:</strong> <span id="api-status">Verificando...</span></p>
        </div>
    </div>

    <script>
        let currentStatus = 'unknown';
        
        // Verificar status a cada 3 segundos
        setInterval(checkStatus, 3000);
        checkStatus(); // Verificar imediatamente
        
        async function checkStatus() {
            try {
                const response = await fetch('http://${BOT_SERVICE}/status');
                const data = await response.json();
                currentStatus = data.status;
                
                updateStatusDisplay(data);
                document.getElementById('api-status').textContent = 'Online ✅';
                
            } catch (error) {
                console.error('Erro ao verificar status:', error);
                document.getElementById('api-status').textContent = 'Offline ❌';
                document.getElementById('status').innerHTML = '❌ Erro de conexão com a API';
                document.getElementById('status').className = 'status error';
            }
        }
        
        function updateStatusDisplay(data) {
            const statusEl = document.getElementById('status');
            const qrSection = document.getElementById('qr-section');
            const connectedSection = document.getElementById('connected-section');
            
            switch(data.status) {
                case 'connected':
                    statusEl.innerHTML = '✅ WhatsApp Conectado';
                    statusEl.className = 'status connected';
                    qrSection.style.display = 'none';
                    connectedSection.style.display = 'block';
                    break;
                    
                case 'qr_ready':
                    statusEl.innerHTML = '📱 Escaneie o QR Code para conectar';
                    statusEl.className = 'status qr_ready';
                    qrSection.style.display = 'block';
                    connectedSection.style.display = 'none';
                    loadQRCode();
                    break;
                    
                case 'disconnected':
                    statusEl.innerHTML = '⚠️ WhatsApp Desconectado';
                    statusEl.className = 'status disconnected';
                    qrSection.style.display = 'none';
                    connectedSection.style.display = 'none';
                    break;
                    
                default:
                    statusEl.innerHTML = '🔄 Conectando...';
                    statusEl.className = 'status disconnected';
            }
        }
        
        async function loadQRCode() {
            try {
                const response = await fetch('http://${BOT_SERVICE}/qr');
                const data = await response.json();
                
                if (data.qr) {
                    document.getElementById('qr-loading').style.display = 'none';
                    document.getElementById('qr-image').src = data.qr;
                    document.getElementById('qr-image').style.display = 'block';
                }
            } catch (error) {
                console.error('Erro ao carregar QR:', error);
                document.getElementById('qr-loading').innerHTML = '❌ Erro ao carregar QR Code';
            }
        }
        
        function refreshQR() {
            document.getElementById('qr-loading').style.display = 'block';
            document.getElementById('qr-image').style.display = 'none';
            restartConnection();
        }
        
        async function restartConnection() {
            try {
                await fetch('http://${BOT_SERVICE}/restart', { method: 'POST' });
                setTimeout(checkStatus, 2000);
            } catch (error) {
                console.error('Erro ao reiniciar:', error);
            }
        }
        
        async function sendTestMessage() {
            const number = document.getElementById('testNumber').value;
            const message = document.getElementById('testMessage').value;
            const responseEl = document.getElementById('test-response');
            
            if (!number || !message) {
                responseEl.innerHTML = '<div class="response error">Preencha todos os campos!</div>';
                return;
            }
            
            try {
                responseEl.innerHTML = '<div class="response">Enviando...</div>';
                
                const response = await fetch('http://${BOT_SERVICE}/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: number, message: message })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    responseEl.innerHTML = '<div class="response success">✅ Mensagem enviada com sucesso!</div>';
                } else {
                    responseEl.innerHTML = '<div class="response error">❌ ' + result.error + '</div>';
                }
                
            } catch (error) {
                responseEl.innerHTML = '<div class="response error">❌ Erro: ' + error.message + '</div>';
            }
        }
    </script>
</body>
</html>
    `)
})

app.listen(PORT, () => {
    console.log(`🌐 Dashboard rodando em http://localhost:${PORT}`)
})
