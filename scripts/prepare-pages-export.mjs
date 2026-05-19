import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [distDir, rawBasePath] = process.argv.slice(2);

if (!distDir || !rawBasePath) {
  console.error('Usage: node scripts/prepare-pages-export.mjs <dist-dir> <base-path>');
  process.exit(1);
}

const basePath = rawBasePath.replace(/\/$/, '');
const basePathJson = JSON.stringify(basePath);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function pageRoute(file) {
  let relative = path.relative(distDir, file).replaceAll(path.sep, '/');

  if (relative === 'index.html') {
    return '/';
  }

  if (relative.endsWith('/index.html')) {
    relative = relative.slice(0, -'/index.html'.length);
  } else if (relative.endsWith('.html')) {
    relative = relative.slice(0, -'.html'.length);
  }

  return `/${relative}`;
}

function withBase(value) {
  if (!value || !value.startsWith('/') || value.startsWith(`${basePath}/`)) {
    return value;
  }

  if (value === '/') {
    return `${basePath}/`;
  }

  const prefixes = [
    '/_next/',
    '/assets/',
    '/favicons/',
    '/guides/',
    '/api-reference/',
    '/sitemap.xml',
  ];

  return prefixes.some((prefix) => value.startsWith(prefix)) ? `${basePath}${value}` : value;
}

function normalizeHtml(html, route) {
  let next = html
    .replace('data-current-path="/"', `data-current-path="${route}"`)
    .replace('!function(){var b="";', `!function(){var b=${basePathJson};`)
    .replaceAll('href="/_next/', `href="${basePath}/_next/`)
    .replaceAll('src="/_next/', `src="${basePath}/_next/`)
    .replaceAll('href="/assets/', `href="${basePath}/assets/`)
    .replaceAll('src="/assets/', `src="${basePath}/assets/`)
    .replaceAll('href="/favicons/', `href="${basePath}/favicons/`)
    .replaceAll('src="/favicons/', `src="${basePath}/favicons/`)
    .replaceAll('content="/favicons/', `content="${basePath}/favicons/`)
    .replaceAll('href="/guides/', `href="${basePath}/guides/`)
    .replaceAll('href="/api-reference/', `href="${basePath}/api-reference/`)
    .replaceAll('href="/sitemap.xml', `href="${basePath}/sitemap.xml`)
    .replaceAll('href="/"', `href="${basePath}/"`)
    .replaceAll('\\"/assets/', `\\"${basePath}/assets/`)
    .replaceAll('\\"/favicons/', `\\"${basePath}/favicons/`)
    .replaceAll('\\"href\\":\\"/guides/', `\\"href\\":\\"${basePath}/guides/`)
    .replaceAll('\\"href\\":\\"/api-reference/', `\\"href\\":\\"${basePath}/api-reference/`)
    .replaceAll('"href":"/guides/', `"href":"${basePath}/guides/`)
    .replaceAll('"href":"/api-reference/', `"href":"${basePath}/api-reference/`)
    .replaceAll('%252Fassets%252F', `%252F${basePath.slice(1)}%252Fassets%252F`);

  next = next.replace(
    "var path = (window.location.pathname || '/').split('#')[0].split('?')[0];",
    `var path = (window.location.pathname || '/');if(path===${basePathJson})path='/';else if(path.indexOf(${basePathJson}+'/')===0)path=path.slice(${basePath.length});path=path.split('#')[0].split('?')[0];`,
  );

  const runtimeScript = `<script>(function(){var b=${basePathJson},p=["/guides/","/api-reference/","/assets/","/favicons/","/_next/","/sitemap.xml"];function f(h){if(!h||typeof h!=="string"||h[0]!=="/"||h.indexOf(b+"/")===0)return h;if(h==="/")return b+"/";for(var i=0;i<p.length;i++)if(h.indexOf(p[i])===0)return b+h;return h}function d(h){return h===b+"/"||h.indexOf(b+"/guides/")===0||h.indexOf(b+"/api-reference/")===0}function s(v){return !v? v:v.split(",").map(function(x){var a=x.trim().split(/\\s+/),u=f(a[0]);a[0]=u;return a.join(" ")}).join(", ")}function r(el,a){var v=el.getAttribute(a),x=a==="srcset"?s(v):f(v);if(x!==v)el.setAttribute(a,x)}function n(root){root=root&&root.querySelectorAll?root:document;root.querySelectorAll("a[href],link[href]").forEach(function(el){r(el,"href")});root.querySelectorAll("img[src],script[src],source[src],iframe[src]").forEach(function(el){r(el,"src")});root.querySelectorAll("[srcset]").forEach(function(el){r(el,"srcset")});root.querySelectorAll("meta[content]").forEach(function(el){r(el,"content")})}var o=Element.prototype.setAttribute;Element.prototype.setAttribute=function(a,v){if(a==="href"||a==="src"||a==="content")v=f(v);if(a==="srcset")v=s(v);return o.call(this,a,v)};["pushState","replaceState"].forEach(function(m){var o=history[m];history[m]=function(st,t,u){if(typeof u==="string")u=f(u);return o.call(this,st,t,u)}});document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a||a.target||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;var h=a.getAttribute("href"),x=f(h);if(x!==h||d(x)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();window.location.href=x}},true);n();new MutationObserver(function(ms){ms.forEach(function(m){if(m.type==="attributes")n(m.target);else m.addedNodes.forEach(n)})}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["href","src","srcset","content"]})})();</script>`;
  const apiReferenceNavScript = `<script data-api-reference-nav>(function(){var b=${basePathJson};function clean(p){if(p===b)return"/";if(p.indexOf(b+"/")===0)p=p.slice(b.length);return p.replace(/\\/$/,"")||"/"}function link(h,t){return'<li class="relative scroll-m-4"><a class="group flex items-start pr-3 py-1.5 cursor-pointer gap-x-3 text-left break-words hyphens-auto rounded-xl w-full outline-offset-[-1px] hover:bg-gray-600/5 dark:hover:bg-gray-200/5 text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300" style="padding-left:1rem" href="'+b+h+'"><div class="flex-1 flex min-w-0 items-start gap-x-2.5"><div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 [word-break:break-word]"><span class="min-w-0 max-w-full break-words hyphens-auto">'+t+"</span></div></div></a></li>"}function group(t,items){return'<div class="mb-6"><div class="sidebar-group-header flex items-center gap-2.5 pl-4 mb-3.5 lg:mb-2.5 font-semibold text-gray-900 dark:text-gray-200"><h5><span>'+t+'</span></h5></div><ul class="sidebar-group space-y-px">'+items.map(function(i){return link(i[0],i[1])}).join("")+"</ul></div>"}function tabs(){document.querySelectorAll(".nav-tabs-item").forEach(function(a){var t=(a.textContent||"").trim(),api=t==="API Reference";a.dataset.active=api?"true":"false";a.classList.toggle("text-gray-800",api);a.classList.toggle("dark:text-gray-200",api);a.classList.toggle("text-gray-600",!api);a.classList.toggle("dark:text-gray-400",!api)})}function apply(){var p=clean(location.pathname);if(p.indexOf("/api-reference/")!==0)return;document.documentElement.setAttribute("data-current-path",p);tabs();var nav=document.getElementById("navigation-items");if(!nav||nav.dataset.apiReferenceNav==="true")return;nav.dataset.apiReferenceNav="true";nav.innerHTML=group("Comece aqui", [["/api-reference/boas-vindas","Boas-vindas"]])+group("Autorizacao", [["/api-reference/autorização/gerar-token-de-api","Gerar token de API"]])+group("Integracao via SDK", [["/api-reference/integração-via-sdk/gerar-tokenonboarding-para-sdk","Gerar TokenOnboarding"],["/api-reference/integração-via-sdk/consultar-resultado-de-onboarding","Consultar onboarding"],["/api-reference/integração-via-sdk/baixar-relatório-pdf-do-onboarding","Baixar PDF do onboarding"]])+group("Servicos", [["/api-reference/serviços--pessoas/executar-serviço-de-dados-risco-ou-compliance","Executar servico externo"]])+group("Customers", [["/api-reference/customers/consultar-cliente","Consultar cliente"],["/api-reference/customers/alterar-status-de-cliente","Alterar status de cliente"]])}apply();setTimeout(apply,500);setTimeout(apply,1500);setTimeout(apply,3000)})();</script>`;

  return next.includes('data-api-reference-nav')
    ? next
    : next.replace('</body>', `${runtimeScript}${apiReferenceNavScript}</body>`);
}

function normalizeJs(js) {
  return js.replaceAll('.p="/_next/"', `.p="${basePath}/_next/"`);
}

const files = await walk(distDir);

for (const file of files) {
  const info = await stat(file);
  if (!info.isFile()) {
    continue;
  }

  if (file.endsWith('.html')) {
    const route = pageRoute(file);
    const html = await readFile(file, 'utf8');
    await writeFile(file, normalizeHtml(html, route));
  }

  if (file.includes(`${path.sep}_next${path.sep}`) && file.endsWith('.js')) {
    const js = await readFile(file, 'utf8');
    await writeFile(file, normalizeJs(js));
  }
}
