import express from 'express';
import path from 'path';

const app = express();
const BASE_PATH = '/remix_-تطبيق-البيع';
const BASE_PATH_ENCODED = encodeURI(BASE_PATH);
const DIST_DIR = path.resolve('./dist');

app.use((req, res, next) => {
  console.log('REQ:', req.method, 'path=', req.path, 'url=', req.url, 'orig=', req.originalUrl);
  next();
});

app.use(BASE_PATH, express.static(DIST_DIR, { index: false }));
app.use(BASE_PATH_ENCODED, express.static(DIST_DIR, { index: false }));

const routes = [BASE_PATH, `${BASE_PATH}/`, BASE_PATH_ENCODED, `${BASE_PATH_ENCODED}/`];
app.get(routes, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.get(`${BASE_PATH}/*`, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});
app.get(`${BASE_PATH_ENCODED}/*`, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

const port = process.env.PORT || 5501;
app.listen(port, () => {
  console.log(`GH Pages preview running at http://localhost:${port}${BASE_PATH}/`);
});
