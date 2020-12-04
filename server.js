const tmi = require('tmi.js');
const express = require('express');
const crypto = require('crypto');
const { Server: WebSocketServer } = require('ws');
const app = express();
const server = app.listen(process.env.PORT, () => {
	const addr = server.address();
	if(typeof addr !== 'string') {
		console.log(`Listening http://localhost:${addr.port}`);
	}
});

app.disable('x-powered-by');

const history = [];

app.use(express.static('dist', { extensions: [ 'html' ] }));

app.get('/api/history', (req, res) => {
	res.send({ history });
});

const wss = new WebSocketServer({
	noServer: true,
	maxPayload: 20000
});

const sockets = [];

server.on('upgrade', (request, socket, head) => {
	wss.handleUpgrade(request, socket, head, ws => {
		ws.json = data => ws.send(JSON.stringify(data));
		wss.emit('connection', ws, request);
	});
});

wss.on('connection', (ws, req) => {
	const id = crypto.randomBytes(8).toString('hex');
	sockets.push(ws);
	console.log(id, 'Client connected', sockets.length, 'connected');
	ws.on('close', (code, reason) => {
		console.log(id, 'Client closed', { code, reason }, sockets.length, 'remaining');
		const index = sockets.findIndex(socket => socket === ws);
		sockets.splice(index, 1);
	});
	ws.json({ hello: 'world' });
});

function broadcast(type, content) {
	sockets.forEach(ws => ws.json({ type, content }));
}

/** @type {tmi.Client} */
const client = new tmi.Client({
	channels: [ 'alca' ],
	options: { debug: true }
});

client.connect();

function handleMessage(channel, tags, message, self) {
	const msg = { channel, tags, message, self };
	broadcast('message', msg);
	history.push(msg);
	if(history.length > 10) {
		history.shift();
	}
}

client.on('message', handleMessage);
client.on('cheer', handleMessage);