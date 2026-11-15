import fs from 'fs';

const css = fs.readFileSync('ponte-suite.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const clientJs = fs.readFileSync('placas-pro.js', 'utf8');

const content = `// site-assets.js
export const CSS_SUITE = ${JSON.stringify(css)};
export const HTML_INDEX = ${JSON.stringify(html)};
export const CLIENT_JS = ${JSON.stringify(clientJs)};
`;

fs.writeFileSync('site-assets.js', content, 'utf8');
console.log('site-assets.js generated successfully!');
