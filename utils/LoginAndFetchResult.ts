import { Cluster } from "puppeteer-cluster";
import { Page, Target } from "puppeteer";

interface FetchInput {
  username?: string;
  password?: string;
  semester?: string;
  cachedCookie?: string;
}

interface FetchOutput {
  text: string | null;
  screenshot: Uint8Array | null;
  pdf: Uint8Array | null;
  cookie?: string;
}

export const cluster = await Cluster.launch({
  concurrency: Cluster.CONCURRENCY_CONTEXT,
  maxConcurrency: 3,
  puppeteerOptions: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

export async function fetchResultWithCluster(
  input: FetchInput
): Promise<FetchOutput> {
  return await cluster.execute(input, async ({ page, data }) => {
    const { username, password, semester, cachedCookie } = data;

    await page.setViewport({ width: 1366, height: 768 });
    await page.goto("https://jcboseustymca.co.in/", {
      waitUntil: "networkidle2",
    });

    if (cachedCookie) {
      console.log("Setting cached cookie...");
      const browserContext = page.browserContext();
      await browserContext.setCookie({
        name: "ASP.NET_SessionId",
        value: cachedCookie,
        domain: "jcboseustymca.co.in",
        httpOnly: true,
        sameSite: "Lax",
      });
      await page.goto(
        "https://jcboseustymca.co.in/Forms/Student/StudentResult.aspx?menuID=119",
        {
          waitUntil: "networkidle2",
        }
      );
    } else if (username && password) {
      console.log("Logging in...");
      await page.type('input[name="txtUserName"]', username);
      await page.type('input[name="txtPassword"]', password);
      await page.click('input[name="btnSubmit"]');
      await page.waitForSelector("#MenuContainer", { timeout: 5000 });

      const isLoggedIn = await page.evaluate(() => {
        const errorMessage = document.getElementById("lblMessage")?.innerText;
        return errorMessage !== "Username or Password are wrong";
      });

      if (!isLoggedIn)
        throw new Error("Login failed. Please check credentials.");

      const cookies = await page.cookies();
      const sessionIdCookie = cookies.find(
        (cookie) => cookie.name === "ASP.NET_SessionId"
      );

      if (sessionIdCookie) {
        await page.goto(
          "https://jcboseustymca.co.in/Forms/Student/StudentResult.aspx?menuID=119",
          {
            waitUntil: "networkidle2",
          }
        );
        return {
          text: null,
          screenshot: null,
          pdf: null,
          cookie: sessionIdCookie.value,
        };
      } else {
        return { text: null, screenshot: null, pdf: null };
      }
    } else {
      throw new Error("Username and password are required for initial login.");
    }

    if (!semester)
      throw new Error("Semester is required to fetch the result page.");

    await page.select("#ContentPlaceHolderBody_ddlSem", "0" + semester);

    const pagePromise: Promise<Page | null> = new Promise((resolve) => {
      page.browser().once("targetcreated", async (target: Target) => {
        const newPage = await target.page();
        resolve(newPage);
      });
    });

    await page.click("#ContentPlaceHolderBody_btnResult");

    await page.waitForNavigation({ timeout: 5000 }).catch(() => {
      console.log("Navigation might not have occurred.");
    });

    const noRecordFound = await page.evaluate(() => {
      const msg = document.getElementById("ContentPlaceHolderBody_lblMessage");
      return msg ? msg.innerText.includes("No Record Found") : false;
    });

    if (noRecordFound) {
      return { text: "Result not published yet!", screenshot: null, pdf: null };
    }

    const newPage = await pagePromise;

    if (newPage) {
      try {
        await newPage.waitForFunction(
          () => document.readyState === "complete",
          { timeout: 12000 }
        );
        await new Promise((res) => setTimeout(res, 3000));
      } catch (err) {
        console.log("Timeout waiting for page ready state.");
      }

      const screenshot = await newPage.screenshot({
        fullPage: true,
        type: "png",
      });

      const pdf = await newPage.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
        landscape: false,
        scale: 1,
        preferCSSPageSize: false,
      });

      const result = await newPage.evaluate(() => document.body.innerText);

      await newPage.close();

      return { text: result, screenshot, pdf };
    } else {
      throw new Error("Failed to open the new result tab.");
    }
  });
}

process.on("SIGINT", async () => {
  await cluster.close();
  process.exit();
});
