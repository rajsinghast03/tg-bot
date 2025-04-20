import puppeteer from "puppeteer";
import { Page, Target } from "puppeteer";

export default async function fetchResult(
  username?: string,
  password?: string,
  semester?: string,
  cachedCookie?: string
): Promise<{
  text: string | null;
  screenshot: Uint8Array | null;
  pdf: Uint8Array | null;
  cookie?: string;
}> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
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
      await page.waitForSelector("#MenuContainer", {
        timeout: 5000,
      });
      console.log("Logged in successfully");

      const isLoggedIn = await page.evaluate(() => {
        const errorMessage = document.getElementById("lblMessage")?.innerText;
        if (errorMessage == "Username or Password are wrong") return false;
        return true;
      });

      if (!isLoggedIn) {
        throw new Error("Login failed. Please check credentials.");
      }

      const cookies = await page.cookies();
      const sessionIdCookie = cookies.find(
        (cookie) => cookie.name === "ASP.NET_SessionId"
      );
      if (sessionIdCookie) {
        console.log("Extracted session cookie:", sessionIdCookie.value);
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
        console.log("ASP.NET_SessionId cookie not found after login.");
        return { text: null, screenshot: null, pdf: null };
      }
    } else {
      throw new Error("Username and password are required for initial login.");
    }

    if (!semester) {
      throw new Error("Semester is required to fetch the result page.");
    }

    console.log("Selecting semester:", semester);
    await page.select("#ContentPlaceHolderBody_ddlSem", "0" + semester);

    const pagePromise: Promise<Page | null> = new Promise((resolve) => {
      browser.once("targetcreated", async (target: Target) => {
        const newPage = await target.page();
        resolve(newPage);
      });
    });

    console.log("Clicking View Result button...");
    await page.click("#ContentPlaceHolderBody_btnResult");

    await page.waitForNavigation({ timeout: 5000 }).catch(() => {
      console.log(
        "Navigation after clicking View Result might not have occurred."
      );
    });

    const noRecordFound = await page.evaluate(() => {
      const messageElement = document.getElementById(
        "ContentPlaceHolderBody_lblMessage"
      );
      return messageElement
        ? messageElement.innerText.includes("No Record Found")
        : false;
    });

    if (noRecordFound) {
      return {
        text: "Result not published yet!",
        screenshot: null,
        pdf: null,
      };
    }

    const newPage = await pagePromise;

    if (newPage) {
      console.log("New result tab opened");

      try {
        await newPage.waitForFunction(
          () => document.readyState === "complete",
          {
            timeout: 12000,
          }
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.log("Page ready state complete");
      } catch (error) {
        console.log("Timeout waiting for page ready state, proceeding anyway");
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

      console.log("Extracting result data...");
      const result = await newPage.evaluate(() => {
        return document.body.innerText;
      });

      await newPage.close();

      return { text: result, screenshot, pdf };
    } else {
      throw new Error("Failed to open the new result tab.");
    }
  } catch (error: any) {
    console.error("Error in fetchResult:", error.message);
    throw error;
  } finally {
    await browser.close();
    console.log("Browser closed");
  }
}
