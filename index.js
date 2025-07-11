// index.js - WhatsApp Bot Simplificado
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const express = require('express')
const fs = require('fs')
const qrcode = require('qrcode')
const https = require('https')
const http = require('http')

const app = express()
app.use(express.json())

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/whatsapp-webhook'
const PORT = process.env.PORT || 3001
const BOT_NAME = process.env.BOT_NAME || 'Assistente Financeiro'

let sock = null
let qrCodeData = null
let connectionStatus = 'disconnected'

// Função para fazer HTTP request sem node-fetch
function sendToN8N(data) {
    return new Promise((resolve, reject) => {
        const url = new URL(N8N_WEBHOOK_URL)
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(data))
            }
        }

        const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
            let body = ''
            res.on('data', chunk => body += chunk)
            res.on('end', () => resolve({ status: res.statusCode, body }))
        })

        req.on('error', reject)
        req.write(JSON.stringify(data))
        req.end()
    })
}

// Função para conectar WhatsApp
async function connectWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./sessions/auth')
        
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            defaultQueryTimeoutMs: 60000,
        })

        sock.ev.on('creds.update', saveCreds)

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update
            
            if (qr) {
                console.log('📱 QR Code gerado!')
                qrCodeData = await qrcode.toDataURL(qr)
                connectionStatus = 'qr_ready'
                
                // Salvar QR como arquivo
                try {
                    if (!fs.existsSync('./qr-codes')) {
                        fs.mkdirSync('./qr-codes', { recursive: true })
                    }
                    await qrcode.toFile('./qr-codes/whatsapp-qr.png', qr)
                } catch (err) {
                    console.log('Erro ao salvar QR:', err.message)
                }
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error instanceof Boom) ? 
                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true
                
                console.log('⚠️ Conexão fechada. Reconectando...', shouldReconnect)
                connectionStatus = 'disconnected'
                
                if (shouldReconnect) {
                    setTimeout(connectWhatsApp, 3000)
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp conectado!')
                connectionStatus = 'connected'
                qrCodeData = null
            }
        })

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return
            
            for (const message of messages) {
                if (message.key.fromMe) continue
                
                const messageData = {
                    id: message.key.id,
                    from: message.key.remoteJid,
                    fromName: message.pushName || 'Usuário',
                    body: extractMessageText(message),
                    timestamp: message.messageTimestamp,
                    messageType: getMessageType(message),
                    isGroup: message.key.remoteJid?.includes('@g.us') || false
                }
                
                console.log('📨 Mensagem:', messageData.fromName, ':', messageData.body)
                
                try {
                    await sendToN8N(messageData)
                    console.log('✅ Enviado para N8N')
                } catch (error) {
                    console.error('❌ Erro N8N:', error.message)
                }
            }
        })

    } catch (error) {
        console.error('❌ Erro conexão:', error.message)
        connectionStatus = 'error'
        setTimeout(connectWhatsApp, 5000)
    }
}

function extractMessageText(message) {
    return message.message?.conversation ||
           message.message?.extendedTextMessage?.text ||
           message.message?.imageMessage?.caption ||
           message.message?.audioMessage ? '[ÁUDIO]' :
           message.message?.imageMessage ? '[IMAGEM]' :
           '[OUTRO]'
}

function getMessageType(message) {
    if (message.message?.conversation || message.message?.extendedTextMessage) return 'text'
    if (message.message?.imageMessage) return 'image'
    if (message.message?.audioMessage) return 'audio'
    return 'other'
}

// API Endpoints
app.get('/status', (req, res) => {
    res.json({
        status: connectionStatus,
        botName: BOT_NAME,
        hasQR: !!qrCodeData,
        timestamp: new Date().toISOString()
    })
})

app.get('/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData })
    } else {
        res.status(404).json({ error: 'QR Code não disponível' })
    }
})

app.post('/send', async (req, res) => {
    try {
        const { to, message } = req.body
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp não conectado' })
        }
        
        const formattedNumber = to.includes('@') ? to : `${to}@s.whatsapp.net`
        await sock.sendMessage(formattedNumber, { text: message })
        
        console.log('📤 Enviado para:', to)
        res.json({ success: true })
        
    } catch (error) {
        console.error('❌ Erro envio:', error.message)
        res.status(500).json({ error: error.message })
    }
})

app.post('/restart', async (req, res) => {
    try {
        if (sock) sock.end()
        connectionStatus = 'restarting'
        setTimeout(connectWhatsApp, 2000)
        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Criar diretórios
const dirs = ['./sessions', './qr-codes']
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
})

app.listen(PORT, () => {
    console.log(`🚀 Bot rodando na porta ${PORT}`)
    connectWhatsApp()
})

process.on('SIGINT', () => {
    console.log('🛑 Encerrando...')
    if (sock) sock.end()
    process.exit(0)
})
