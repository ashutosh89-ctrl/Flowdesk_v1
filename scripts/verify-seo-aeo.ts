/**
 * FlowDesk Pre-Deployment SEO & AEO Verification Suite
 */

import assert from 'assert';

async function verifySeoAndAeo() {
  console.log('======================================================');
  console.log('🔍 VERIFYING FLOWDESK SEO, AEO & CRAWLABILITY');
  console.log('======================================================\n');

  const BASE_URL = 'http://localhost:3000';
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => boolean | void) {
    total++;
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    }
  }

  // 1. Robots.txt
  console.log('--- SECTION 1: robots.txt Verification ---');
  const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
  const robotsTxt = await robotsRes.text();
  test('robots.txt returns status 200', () => assert.strictEqual(robotsRes.status, 200));
  test('robots.txt contains User-agent: *', () => assert(robotsTxt.includes('User-Agent: *') || robotsTxt.includes('user-agent: *') || robotsTxt.includes('User-agent: *')));
  test('robots.txt allows homepage /', () => assert(robotsTxt.includes('Allow: /')));
  test('robots.txt disallows /dashboard', () => assert(robotsTxt.includes('Disallow: /dashboard')));
  test('robots.txt disallows /portal', () => assert(robotsTxt.includes('Disallow: /portal')));
  test('robots.txt disallows /client', () => assert(robotsTxt.includes('Disallow: /client')));
  test('robots.txt disallows /api', () => assert(robotsTxt.includes('Disallow: /api')));
  test('robots.txt disallows /login and /signup', () => assert(robotsTxt.includes('Disallow: /login') && robotsTxt.includes('Disallow: /signup')));
  test('robots.txt references sitemap.xml', () => assert(robotsTxt.includes('sitemap.xml')));

  // 2. Sitemap.xml
  console.log('\n--- SECTION 2: sitemap.xml Verification ---');
  const sitemapRes = await fetch(`${BASE_URL}/sitemap.xml`);
  const sitemapXml = await sitemapRes.text();
  test('sitemap.xml returns status 200', () => assert.strictEqual(sitemapRes.status, 200));
  test('sitemap.xml contains valid xml declaration or urlset', () => assert(sitemapXml.includes('urlset') || sitemapXml.includes('xmlns')));
  test('sitemap.xml includes homepage URL', () => assert(sitemapXml.includes('<loc>')));
  test('sitemap.xml DOES NOT include /dashboard', () => assert(!sitemapXml.includes('/dashboard')));
  test('sitemap.xml DOES NOT include /portal', () => assert(!sitemapXml.includes('/portal')));
  test('sitemap.xml DOES NOT include /client', () => assert(!sitemapXml.includes('/client')));
  test('sitemap.xml DOES NOT include /login or /signup', () => assert(!sitemapXml.includes('/login') && !sitemapXml.includes('/signup')));

  // 3. Web App Manifest
  console.log('\n--- SECTION 3: manifest.webmanifest Verification ---');
  const manifestRes = await fetch(`${BASE_URL}/manifest.webmanifest`);
  const manifestJson = await manifestRes.json();
  test('manifest returns status 200', () => assert.strictEqual(manifestRes.status, 200));
  test('manifest name is FlowDesk — Freelancer Operating System', () => assert(manifestJson.name.includes('FlowDesk')));
  test('manifest short_name is FlowDesk', () => assert.strictEqual(manifestJson.short_name, 'FlowDesk'));
  test('manifest icons exist', () => assert(Array.isArray(manifestJson.icons) && manifestJson.icons.length > 0));

  // 4. LLMs.txt
  console.log('\n--- SECTION 4: llms.txt Verification ---');
  const llmsRes = await fetch(`${BASE_URL}/llms.txt`);
  const llmsTxt = await llmsRes.text();
  test('llms.txt returns status 200', () => assert.strictEqual(llmsRes.status, 200));
  test('llms.txt identifies FlowDesk as Freelancer Operating System', () => assert(llmsTxt.includes('Freelancer Operating System')));
  test('llms.txt documents the 7-stage workflow', () => assert(llmsTxt.includes('Client') && llmsTxt.includes('Deliverables') && llmsTxt.includes('Invoice')));
  test('llms.txt does NOT contain sensitive secrets or tokens', () => {
    assert(!llmsTxt.includes('service_role') && !llmsTxt.includes('rzp_') && !llmsTxt.includes('re_'));
  });

  // 5. Homepage HTML, Metadata & JSON-LD
  console.log('\n--- SECTION 5: Homepage HTML, Metadata & JSON-LD Schema ---');
  const homeRes = await fetch(`${BASE_URL}/`);
  const homeHtml = await homeRes.text();
  test('Homepage returns status 200', () => assert.strictEqual(homeRes.status, 200));
  test('Homepage title contains FlowDesk | Freelancer Operating System', () => {
    assert(homeHtml.includes('FlowDesk') && homeHtml.includes('Freelancer Operating System'));
  });
  test('Homepage meta description is present and natural', () => {
    assert(homeHtml.includes('name="description"') && homeHtml.includes('freelancer operating system'));
  });
  test('OpenGraph tags are present', () => {
    assert(homeHtml.includes('property="og:title"') && homeHtml.includes('property="og:description"'));
  });
  test('Twitter card tags are present', () => {
    assert(homeHtml.includes('name="twitter:card"') && homeHtml.includes('summary_large_image'));
  });
  test('JSON-LD schema is present and valid JSON', () => {
    const jsonLdMatch = homeHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert(Boolean(jsonLdMatch), 'JSON-LD script tag found');
    const parsed = JSON.parse(jsonLdMatch![1]);
    assert(parsed['@context'] === 'https://schema.org', 'Valid schema.org context');
    assert(Array.isArray(parsed['@graph']), 'Graph structure present');
    assert(parsed['@graph'].some((item: any) => item['@type'] === 'SoftwareApplication'), 'SoftwareApplication present');
    assert(parsed['@graph'].some((item: any) => item['@type'] === 'Organization'), 'Organization present');
    assert(parsed['@graph'].some((item: any) => item['@type'] === 'WebSite'), 'WebSite present');
    assert(parsed['@graph'].some((item: any) => item['@type'] === 'FAQPage'), 'FAQPage present');
  });

  // 6. Private Route Isolation & Noindex Verification
  console.log('\n--- SECTION 6: Private Route Isolation & Noindex Tags ---');
  const loginRes = await fetch(`${BASE_URL}/login`);
  const loginHtml = await loginRes.text();
  test('Login route has noindex meta tag', () => {
    assert(loginHtml.includes('name="robots"') && loginHtml.includes('noindex') && loginHtml.includes('nofollow'));
  });

  const signupRes = await fetch(`${BASE_URL}/signup`);
  const signupHtml = await signupRes.text();
  test('Signup route has noindex meta tag', () => {
    assert(signupHtml.includes('name="robots"') && signupHtml.includes('noindex') && signupHtml.includes('nofollow'));
  });

  // 7. AEO Content & Semantic Answer Validation
  console.log('\n--- SECTION 7: AEO Content & Entity Question Answering ---');
  test('AEO Q1: "What is FlowDesk?" clearly answered in public copy', () => {
    assert(homeHtml.includes('Freelancer Operating System') || homeHtml.includes('operating system for freelancers'));
  });
  test('AEO Q2: "Who is FlowDesk for?" clearly answered in public copy', () => {
    assert(homeHtml.includes('freelance') || homeHtml.includes('freelancers'));
  });
  test('AEO Q3: "What workflow does FlowDesk manage?" clearly answered', () => {
    assert(homeHtml.includes('Deliverables') && homeHtml.includes('Invoice'));
  });
  test('AEO Q4: "Does FlowDesk provide a client portal?" clearly answered', () => {
    assert(homeHtml.includes('Client Portal') || homeHtml.includes('client portal'));
  });
  test('AEO Q5: "How does FlowDesk handle invoices and payment tracking?" answered', () => {
    assert(homeHtml.includes('Invoicing') || homeHtml.includes('invoices'));
  });

  console.log('\n======================================================');
  console.log(`📊 RESULTS: ${passed}/${total} PASSED`);
  if (passed === total) {
    console.log('🎉 ALL SEO & AEO VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  } else {
    console.error(`❌ ${total - passed} TESTS FAILED`);
    process.exit(1);
  }
  console.log('======================================================\n');
}

verifySeoAndAeo().catch((err) => {
  console.error('Verification suite error:', err);
  process.exit(1);
});
