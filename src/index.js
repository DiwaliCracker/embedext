import puppeteer from "@cloudflare/puppeteer";

export default {
  async fetch(request, env) {
    const reqUrl = new URL(request.url);
    const targetUrl = reqUrl.searchParams.get("url");
    const shouldRedirect = reqUrl.searchParams.get("redirect") === "true";

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: "Missing ?url= parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const processUrl = `https://9xbuddy.in/process?url=${encodeURIComponent(targetUrl)}`;

    let browser;
    try {
      browser = await puppeteer.launch(env.MYBROWSER);
      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      );

      await page.goto(processUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      let workerLinks = [];
      for (let i = 0; i < 25; i++) {
        workerLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a[href]"))
            .map((a) => ({
              text: (a.innerText || a.textContent || "").trim(),
              href: a.href,
            }))
            .filter((item) => item.href.includes("workers.dev"));
        });

        if (workerLinks.length > 0) {
          await new Promise((r) => setTimeout(r, 1500));
          workerLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("a[href]"))
              .map((a) => ({
                text: (a.innerText || a.textContent || "").trim(),
                href: a.href,
              }))
              .filter((item) => item.href.includes("workers.dev"));
          });
          break;
        }

        await new Promise((r) => setTimeout(r, 1000));
      }

      await browser.close();

      if (workerLinks.length === 0) {
        return new Response(
          JSON.stringify({
            error: "No workers.dev links found (timed out or blocked by bot check).",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      const lastLink = workerLinks[workerLinks.length - 1];

      if (shouldRedirect) {
        return Response.redirect(lastLink.href, 302);
      }

      return new Response(
        JSON.stringify(
          {
            status: "success",
            total_found: workerLinks.length,
            selected_text: lastLink.text,
            link: lastLink.href,
            all_worker_links: workerLinks,
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (err) {
      if (browser) {
        await browser.close();
      }
      return new Response(
        JSON.stringify({ error: "Extraction failed", details: err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
