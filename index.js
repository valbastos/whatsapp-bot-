// index.js - WhatsApp Bot Financeiro
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const express = require('express')
const fs = require('fs')
const path = require('path')
const qrcode = require('qrcode')

const app = express()
app.use(express.json())

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/whatsapp-webhook'
const PORT = process.env.PORT || 3001
const BOT_NAME = process.env.BOT_NAME || 'Assistente Financeiro'

let sock = null
let qrCodeData = null
let connectionStatus = 'disconnected'

// Função para conectar WhatsApp
async function connectWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./sessions/auth')
        
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // Não mostrar no terminal
            defaultQueryTimeoutMs: 60000,
        })

        // Salvar credenciais quando atualizadas
        sock.ev.on('creds.update', saveCreds)

        // QR Code para conectar
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update
            
            if (qr) {
                console.log('📱 QR Code gerado! Acesse http://localhost:3002 para escanear')
                
                // Gerar QR Code como imagem
                qrCodeData = await qrcode.toDataURL(qr)
                
                // Salvar QR como arquivo também
                const qrPath = './qr-codes/whatsapp-qr.png'
                await qrcode.toFile(qrPath, qr)
                
                connectionStatus = 'qr_ready'
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
                console.log('⚠️ Conexão fechada. Reconectando...', shouldReconnect)
                connectionStatus = 'disconnected'
                
                if (shouldReconnect) {
                    setTimeout(connectWhatsApp, 3000)
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp conectado com sucesso!')
                connectionStatus = 'connected'
                qrCodeData = null // Limpar QR após conexão
            }
        })

        // Receber mensagens
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return
            
            for (const message of messages) {
                if (message.key.fromMe) continue // Ignorar mensagens próprias
                
                const messageData = {
                    id: message.key.id,
                    from: message.key.remoteJid,
                    fromName: message.pushName || 'Usuário',
                    body: extractMessageText(message),
                    timestamp: message.messageTimestamp,
                    messageType: getMessageType(message),
                    isGroup: message.key.remoteJid?.includes('@g.us'),
                    mediaUrl: await extractMediaUrl(message)
                }
                
                console.log('📨 Mensagem recebida:', messageData.fromName, ':', messageData.body)
                
                // Enviar para N8N
                try {
                    await fetch(N8N_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(messageData)
                    })
                } catch (error) {
                    console.error('❌ Erro ao enviar para N8N:', error.message)
                }
            }
        })

    } catch (error) {
        console.error('❌ Erro ao conectar WhatsApp:', error)
        connectionStatus = 'error'
        setTimeout(connectWhatsApp, 5000)
    }
}

// Extrair texto da mensagem
function extractMessageText(message) {
    return message.message?.conversation ||
           message.message?.extendedTextMessage?.text ||
           message.message?.imageMessage?.caption ||
           message.message?.videoMessage?.caption ||
           message.message?.audioMessage ? '[ÁUDIO]' :
           message.message?.imageMessage ? '[IMAGEM]' :
           message.message?.videoMessage ? '[VÍDEO]' :
           message.message?.documentMessage ? '[DOCUMENTO]' :
           '[MENSAGEM NÃO SUPORTADA]'
}

// Identificar tipo da mensagem
function getMessageType(message) {
    if (message.message?.conversation || message.message?.extendedTextMessage) return 'text'
    if (message.message?.imageMessage) return 'image'
    if (message.message?.audioMessage) return 'audio'
    if (message.message?.videoMessage) return 'video'
    if (message.message?.documentMessage) return 'document'
    return 'unknown'
}

// Extrair URL de mídia (se necessário)
async function extractMediaUrl(message) {
    // Para implementar depois se precisar baixar mídias
    return null
}

// API Endpoints

// Status da conexão
app.get('/status', (req, res) => {
    res.json({
        status: connectionStatus,
        botName: BOT_NAME,
        hasQR: !!qrCodeData,
        timestamp: new Date().toISOString()
    })
})

// QR Code
app.get('/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData })
    } else {
        res.status(404).json({ error: 'QR Code não disponível' })
    }
})

// Enviar mensagem
app.post('/send', async (req, res) => {
    try {
        const { to, message } = req.body
        
        if (!sock || connectionStatus !== 'connected') {
            return res.status(400).json({ error: 'WhatsApp não conectado' })
        }
        
        // Formatar número (adicionar @s.whatsapp.net se necessário)
        const formattedNumber = to.includes('@') ? to : `${to}@s.whatsapp.net`
        
        await sock.sendMessage(formattedNumber, { text: message })
        
        console.log('📤 Mensagem enviada para:', to)
        res.json({ success: true, message: 'Mensagem enviada com sucesso' })
        
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error)
        res.status(500).json({ error: error.message })
    }
})

// Restart conexão
app.post('/restart', async (req, res) => {
    try {
        if (sock) {
            sock.end()
        }
        connectionStatus = 'restarting'
        setTimeout(connectWhatsApp, 2000)
        res.json({ success: true, message: 'Reiniciando conexão...' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Criar diretórios necessários
const dirs = ['./sessions', './qr-codes']
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
})

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Bot servidor rodando na porta ${PORT}`)
    console.log(`📊 Status: http://localhost:${PORT}/status`)
    console.log(`📱 QR Code: http://localhost:${PORT}/qr`)
    console.log(`📤 Enviar: POST http://localhost:${PORT}/send`)
    
    // Conectar WhatsApp
    connectWhatsApp()
})

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Encerrando bot...')
    if (sock) {
        sock.end()
    }
    process.exit(0)
})
