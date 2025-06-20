const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const manifestPath = path.join(docsDir, 'asset-manifest.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function renameAsset(oldRel, newRel) {
  const oldPath = path.join(docsDir, oldRel);
  const newPath = path.join(docsDir, newRel);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
}

const cssHashPath = manifest.files['main.css'];
const jsHashPath = manifest.files['main.js'];

const cssHash = path.basename(cssHashPath); // e.g., main.b5fe84f4.css
const jsHash = path.basename(jsHashPath); // e.g., main.80c499e9.js

// rename css and js files
renameAsset(`static/css/${cssHash}`, 'static/css/main.css');
renameAsset(`static/css/${cssHash}.map`, 'static/css/main.css.map');
renameAsset(`static/js/${jsHash}`, 'static/js/main.js');
renameAsset(`static/js/${jsHash}.map`, 'static/js/main.js.map');
renameAsset(`static/js/${jsHash}.LICENSE.txt`, 'static/js/main.js.LICENSE.txt');

// update manifest paths
manifest.files['main.css'] = '/LiveDocs/static/css/main.css';
manifest.files['main.js'] = '/LiveDocs/static/js/main.js';
if (manifest.files[`${cssHash}.map`]) {
  manifest.files['main.css.map'] = '/LiveDocs/static/css/main.css.map';
  delete manifest.files[`${cssHash}.map`];
}
if (manifest.files[`${jsHash}.map`]) {
  manifest.files['main.js.map'] = '/LiveDocs/static/js/main.js.map';
  delete manifest.files[`${jsHash}.map`];
}

manifest.entrypoints = manifest.entrypoints.map((entry) =>
  entry.replace(cssHash, 'main.css').replace(jsHash, 'main.js')
);

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// update index.html
const indexPath = path.join(docsDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(new RegExp(cssHash, 'g'), 'main.css');
html = html.replace(new RegExp(jsHash, 'g'), 'main.js');
fs.writeFileSync(indexPath, html);
