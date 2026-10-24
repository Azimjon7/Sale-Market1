'use strict';
const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const { minify } = require('terser');
const root = path.resolve(__dirname, '..');

const shared = ['design-system.css','components.css','bootstrap.min.css','font-awesome.min.css','elegant-icons.css','slicknav.min.css','style.css','marketplace-upgrade.css','mobile-premium.css'];
const tail = ['shared-header.css','mobile-320-480-fix.css','live-upgrade-fixes.css','customer-navigation.css','dodola-tokens.css','dodola-customer.css','dodola-marketplace.css','dodola-theme.css'];
const bundles = {
  'storefront-home.bundle.css': [...shared,'homepage-polish.css',...tail.slice(0,2),'mobile-homepage.css',...tail.slice(2,-1),'dodola-luxury-pilot.css','dodola-theme.css'],
  'storefront-catalog.bundle.css': [...shared,...tail.slice(0,2),'mobile-catalog-filter.css','shop-toolbar.css',...tail.slice(2,-1),'catalog-compact.css','dodola-theme.css'],
  'storefront-product.bundle.css': [...shared.filter(name => name !== 'slicknav.min.css'),...tail],
  'storefront-cart.bundle.css': [...shared,...tail],
  'storefront-checkout.bundle.css': ['checkout-premium.css','dodola-tokens.css','dodola-customer.css','dodola-marketplace.css','dodola-theme.css'],
};

const scriptBundles = {
  'storefront-home.bundle.js': ['jquery-3.3.1.min.js','bootstrap.min.js','jquery.slicknav.js','main.js','product-rules.js','helpers.js','search-engine.js','store.js','marketplace-upgrade.js','shared-header-init.js','header-account.js','index-products.js','dodola-ui.js'],
  'storefront-catalog.bundle.js': ['jquery-3.3.1.min.js','bootstrap.min.js','jquery.slicknav.js','main.js','product-rules.js','helpers.js','search-engine.js','store.js','marketplace-upgrade.js','shared-header-init.js','shop-products.js','shop-toolbar.js','header-account.js','dodola-ui.js'],
  'storefront-cart.bundle.js': ['jquery-3.3.1.min.js','bootstrap.min.js','jquery.slicknav.js','main.js','product-rules.js','store.js','panel-manager.js','marketplace-upgrade.js','shared-header-init.js','cart-page.js','header-account.js','dodola-ui.js'],
  'storefront-checkout.bundle.js': ['dodola-ui.js','product-rules.js','store.js','order-submit.js','checkout-v2.js'],
};

async function build() {
  for (const [output, files] of Object.entries(bundles)) {
    const source = files.map(file => `/* ${file} */\n${fs.readFileSync(path.join(root, 'css', file), 'utf8')}`).join('\n');
    const result = new CleanCSS({ level: { 1: { specialComments: 'all' }, 2: false } }).minify(source);
    if (result.errors.length) throw new Error(`${output}: ${result.errors.join('; ')}`);
    fs.writeFileSync(path.join(root, 'css', output), result.styles);
  }
  for (const [output, files] of Object.entries(scriptBundles)) {
    const source = files.map(file => `/* ${file} */\n${fs.readFileSync(path.join(root, 'js', file), 'utf8')}`).join('\n;\n');
    const result = await minify(source, { compress: false, mangle: false, format: { comments: /^!/ } });
    if (!result.code) throw new Error(`${output}: empty JavaScript bundle`);
    fs.writeFileSync(path.join(root, 'js', output), result.code);
  }
  console.log(JSON.stringify({ ok: true, bundles: [...Object.keys(bundles), ...Object.keys(scriptBundles)] }));
}

build().catch(error => { console.error(error.message); process.exitCode = 1; });
