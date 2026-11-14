#!/usr/bin/env node
/**
 * Ardson Maritime — static page build script.
 *
 * For each entry in pages.json it injects the shared header / footer /
 * modal partials into _partials/shell.html and writes a standalone .html
 * file at the repo root.
 *
 * The page body itself lives in _pages/<slug>.html so the markup stays
 * editable without escaping HTML inside JSON.
 *
 * SEO/GEO metadata (canonical URL, Open Graph type, JSON-LD) is derived
 * from the page entry and the site constants below.
 *
 * Usage (from repo root):  node scripts/build.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const ASSET_FILES = [
    'css/styles.css',
    'css/pages.css',
    'css/admin.css',
    'js/sanitize.js',
    'js/site.js',
    'js/pages.js',
    'js/app.js',
    'js/admin.js'
];
const assetVersion = createHash('sha256')
    .update(ASSET_FILES.map(read).join('\0'))
    .digest('hex')
    .slice(0, 10);

const SITE_URL = 'https://www.ardsonmaritime.com';
const SITE_NAME = 'Ardson Maritime Career Center';
const ORG_ID = SITE_URL + '/#organization';

const shell = read('_partials/shell.html').trimEnd();
const header = read('_partials/header.html').trimEnd();
const footer = read('_partials/footer.html').trimEnd();
const modals = read('_partials/modals.html').trimEnd();

const pages = JSON.parse(read('pages.json'));

/* ---------- JSON-LD ---------- */
const organisation = {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    alternateName: 'Ardson Maritime',
    url: SITE_URL,
    description: 'Indonesian maritime manning agency connecting STCW-verified seafarers with international shipowners. Free registration under MLC 2006.',
    email: 'ardsonmaritime@outlook.com',
    telephone: '+6285211254485',
    address: {
        '@type': 'PostalAddress',
        streetAddress: 'Purbalingga',
        addressLocality: 'Purbalingga',
        addressRegion: 'Central Java',
        addressCountry: 'ID'
    },
    geo: { '@type': 'GeoCoordinates', latitude: -7.3058, longitude: 109.3654 },
    areaServed: { '@type': 'Place', name: 'Worldwide' },
    knowsAbout: [
        'Maritime recruitment',
        'STCW 2010 certification',
        'Maritime Labour Convention 2006',
        'Crew manning agency',
        'Seafarer placement'
    ],
    sameAs: []
};

const website = {
    '@type': 'WebSite',
    '@id': SITE_URL + '/#website',
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID }
};

const service = {
    '@type': 'EmploymentAgency',
    '@id': SITE_URL + '/#agency',
    name: SITE_NAME,
    url: SITE_URL,
    telephone: '+6285211254485',
    email: 'ardsonmaritime@outlook.com',
    priceRange: 'Free for seafarers',
    address: organisation.address,
    geo: organisation.geo,
    parentOrganization: { '@id': ORG_ID }
};

function breadcrumb(page) {
    const trail = [{ name: 'Home', path: '/' }];
    if (page.crumb) trail.push({ name: page.crumb, path: '/' + page.slug });
    return {
        '@type': 'BreadcrumbList',
        itemListElement: trail.map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.name,
            item: SITE_URL + item.path
        }))
    };
}

function jsonLd(page) {
    const graph = [organisation, website];
    if (page.slug === 'index' || page.jsonld === 'home') graph.push(service);
    if (page.crumb) graph.push(breadcrumb(page));
    if (page.faq?.length) {
        graph.push({
            '@type': 'FAQPage',
            mainEntity: page.faq.map((q) => ({
                '@type': 'Question',
                name: q.q,
                acceptedAnswer: { '@type': 'Answer', text: q.a }
            }))
        });
    }
    if (page.jsonld === 'article') {
        graph.push({
            '@type': 'CollectionPage',
            name: page.title,
            url: SITE_URL + '/' + page.slug,
            isPartOf: { '@id': SITE_URL + '/#website' }
        });
    }
    return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)
        .replace(/</g, '\\u003c');
}

/* ---------- Analytics (GA4) ---------- */
/* Set GA4_ID in the environment (or in pages.json as a top-level key) to
   emit the Google Analytics snippet on every page. When unset, nothing is
   emitted, so local builds and previews stay free of analytics traffic. */
const GA4_ID = (process.env.GA4_ID || '').trim();
const GA4_SNIPPET = GA4_ID
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA4_ID}');
    </script>`
    : '';

/* ---------- Build ---------- */
const built = [];
for (const page of pages) {
    const main = read(join('_pages', page.slug + '.html')).trimEnd();
    const canonical = SITE_URL + '/' + (page.slug === 'index' ? '' : page.slug);
    const preload = page.preload
        ? `<link rel="preload" as="image" fetchpriority="high" href="${page.preload}"`
            + (page.preloadSrcset ? ` imagesrcset="${page.preloadSrcset}"` : '')
            + (page.preloadSizes ? ` imagesizes="${page.preloadSizes}"` : '')
            + '>'
        : '';

    const html = shell
        .replaceAll('{{DESC}}', page.desc)
        .replaceAll('{{TITLE}}', page.title)
        .replaceAll('{{PAGE}}', page.page)
        .replaceAll('{{CANONICAL}}', canonical)
        .replaceAll('{{OG_TYPE}}', page.ogType || 'website')
        .replaceAll('{{ROBOTS}}', page.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
        .replaceAll('{{PRELOAD}}', preload)
        .replaceAll('{{JSONLD}}', jsonLd(page))
        .replaceAll('{{ASSET_VERSION}}', assetVersion)
        .replaceAll('{{GA4_SNIPPET}}', GA4_SNIPPET)
        .replaceAll('{{HEADER}}', header)
        .replaceAll('{{MAIN}}', main)
        .replaceAll('{{FOOTER}}', footer)
        .replaceAll('{{MODALS}}', modals);

    writeFileSync(join(root, page.slug + '.html'), html + '\n');
    built.push(page.slug + '.html');
}

/* Hand-maintained pages are not built from _partials, but their css/js
   references still need the same cache-busting version. */
for (const rel of ['index.html', 'admin/index.html', 'admin/login.html']) {
    const html = read(rel).replace(
        /\b(href|src)="((?:\.\.\/)?(?:css|js)\/[^"?]+)(?:\?v=[^"]*)?"/g,
        (_match, attr, url) => `${attr}="${url}?v=${assetVersion}"`
    );
    writeFileSync(join(root, rel), html);
}

/* ---------- sitemap.xml ---------- */
const today = new Date().toISOString().slice(0, 10);

const homeEntry = `    <url>
        <loc>${SITE_URL}/</loc>
        <lastmod>${today}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>`;

const entries = pages
    // job.html and insight.html are shells whose real URL carries ?id= /
    // ?slug=; listing the empty shell would put a 404-equivalent in the index.
    .filter((p) => !p.noindex && !['job', 'insight'].includes(p.slug))
    .map((p) => {
        const loc = SITE_URL + '/' + p.slug;
        const priority = p.priority ?? '0.7';
        return `    <url>
        <loc>${loc}</loc>
        <lastmod>${today}</lastmod>
        <changefreq>${p.changefreq || 'monthly'}</changefreq>
        <priority>${priority}</priority>
    </url>`;
    });

writeFileSync(join(root, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [homeEntry, ...entries].join('\n') + '\n</urlset>\n');

console.log('Built ' + built.length + ' pages: ' + built.join(', '));
console.log('Wrote sitemap.xml with ' + (entries.length + 1) + ' URLs.');
