// Layanan model palsu (kontrak 5) untuk tes: server HTTP lokal yang jawabannya diatur per tes.
//
// Pakai:
//   const ml = mlMock();
//   before(() => ml.start()); // mengisi process.env.ML_SERVICE_URL
//   after(() => ml.stop());
//   ml.reply = () => [500, { ... }]; // [status, body], atau 'hang' supaya tidak pernah membalas (timeout)
//   ml.requests; // [{ method, url, apiKey, body }] yang diterima
//   ml.reset(); // kosongkan requests, kembali ke jawaban normal
const http = require('node:http');
const { once } = require('node:events');

// Jawaban POST /v1/size-estimate (kontrak 5).
const estimate = (size = 'M') => ({
  size,
  inRange: true,
  message: `Perkiraan ukuran ${size} berdasarkan tabel ukuran`,
  tableVersion: 'sementara-1',
});

const normal = (req) =>
  req.url === '/v1/health'
    ? [200, { status: 'ok', models: { sizeEstimator: 'sementara-1', demand: '1.0.0' } }]
    : [200, estimate()];

function mlMock() {
  const ml = {
    requests: [],
    reply: normal,
    reset() {
      ml.requests = [];
      ml.reply = normal;
    },
    async start() {
      server.listen(0, 'localhost');
      await once(server, 'listening');
      process.env.ML_SERVICE_URL = `http://localhost:${server.address().port}`;
    },
    stop() {
      server.closeAllConnections(); // termasuk request 'hang' yang belum dibalas
      server.close();
    },
  };
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    ml.requests.push({
      method: req.method,
      url: req.url,
      apiKey: req.headers['x-api-key'],
      body: body ? JSON.parse(body) : undefined,
    });
    const answer = ml.reply(req);
    if (answer === 'hang') return;
    res.writeHead(answer[0], { 'content-type': 'application/json' }).end(JSON.stringify(answer[1]));
  });
  return ml;
}

module.exports = { mlMock, estimate };
