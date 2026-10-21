const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const baseUrl = process.env.LANDING_QA_URL || 'http://127.0.0.1:4173/landing'
const outputDir = path.join(process.cwd(), 'output', 'justcrm-landing-redesign')
fs.mkdirSync(outputDir, { recursive: true })

async function capture(browser, name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  const consoleErrors = []
  const pageErrors = []

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' })
  await page.waitForTimeout(250)

  const metrics = await page.evaluate(() => ({
    title: document.title,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyHeight: document.body.scrollHeight,
    missingImages: Array.from(document.images).filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.src),
    demoLinks: Array.from(document.querySelectorAll('a[href="#contacto"]')).length,
    pricesMentioned: /\$\s?\d|USD\s?\d|ARS\s?\d/i.test(document.body.innerText),
    forbiddenAiName: /\bNISSI\b/i.test(document.body.innerText),
  }))

  if (name === 'mobile') {
    const menuButton = page.locator('button[aria-expanded]').first()
    await menuButton.click()
    await page.waitForTimeout(350)
    metrics.mobileMenuVisible = await page.getByRole('navigation', { name: 'Navegación móvil' }).isVisible()
    await menuButton.click()
    await page.waitForTimeout(350)
    metrics.mobileMenuClosed = (await menuButton.getAttribute('aria-expanded')) === 'false'
  }

  await page.locator('#usuarios').scrollIntoViewIfNeeded()
  const technicianTab = page.getByRole('tab', { name: 'Técnicos' })
  await technicianTab.click()
  await page.waitForTimeout(350)
  metrics.roleSelected = await technicianTab.getAttribute('aria-selected')
  metrics.roleTabWorks = (await page.locator('#usuarios').innerText()).includes('Una vista móvil para saber qué hacer y dónde')
  await page.locator('#usuarios').screenshot({ path: path.join(outputDir, `${name}-roles.png`) })

  const pageHeight = await page.evaluate(() => document.body.scrollHeight)
  for (let y = 0; y < pageHeight; y += Math.max(500, Math.floor(viewport.height * 0.72))) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y)
    await page.waitForTimeout(45)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(450)

  await page.screenshot({ path: path.join(outputDir, `${name}-viewport.png`), fullPage: false })
  await page.screenshot({ path: path.join(outputDir, `${name}-full.png`), fullPage: true })
  await page.close()

  return { name, viewport, metrics, consoleErrors, pageErrors }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const results = []
  results.push(await capture(browser, 'desktop', { width: 1536, height: 1024 }))
  results.push(await capture(browser, 'tablet', { width: 820, height: 1180 }))
  results.push(await capture(browser, 'mobile', { width: 390, height: 844 }))
  await browser.close()
  process.stdout.write(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
