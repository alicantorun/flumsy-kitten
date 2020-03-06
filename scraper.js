const puppeteer = require("puppeteer");
const transform = require("stream-transform");
const fs = require("fs");

let browser;
let page;

// This is where we'll put the code to get around the tests.
const preparePageForTests = async page => {
  // Pass the User-Agent Test.
  const userAgent =
    "Mozilla/5.0 (X11; Linux x86_64)" +
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36";
  await page.setUserAgent(userAgent);
};

//SCRAPE LINKS
async function scrapeLinks(searchParameter) {
  const totalPage = 5;

  console.log("searchParameter: ", searchParameter);

  console.log("Launching browser");
  browser = await puppeteer.launch();

  console.log("opening tab");
  page = await browser.newPage();
  page.on("console", msg => console.log("PAGE LOG:", msg.text()));

  const csvLinks = [];
  for (let index = 1; index <= totalPage; index++) {
    const pageLink = `https://plasticker.de/recybase/listaog.php?aog=${searchParameter}&spec=&sort=time%20DESC&snation=&show=0${index}`;
    await page.goto(pageLink);
    console.log(`parsing links from page ${index} of ${totalPage}`);
    const parsedLinks = await parseLinks();
    parsedLinks.forEach(linkItem => {
      csvLinks.push([linkItem]);
    });
  }

  if (searchParameter === "A") {
    await transformToCsv("buyersLinks", csvLinks);
  } else if (searchParameter === "G") {
    await transformToCsv("sellersLinks", csvLinks);
  }

  await browser.close();
}

//SCRAPE INFO
async function scrapeInfo(links, companiesParameter) {
  try {
    console.log("Launching browser");
    browser = await puppeteer.launch();
    console.log("Opening tab");
    page = await browser.newPage();
    page.on("console", msg => console.log("PAGE LOG:", msg.text()));

    console.log("Logging in");
    await page.goto(
      "https://plasticker.de/marktplatz/login.php?goto=../../index.php?"
    );

    await page.type(
      "#normal1 > form > p:nth-child(1) > input[type='text']",
      "chris.n.schiller@gmail.com"
    );
    await page.type(
      "#normal1 > form > p:nth-child(2) > input[type='password']",
      "Plasticker20!9"
    );

    await Promise.all([
      page.waitForNavigation(),
      page.click("#normal1 > form > input[type='submit']:nth-child(3)")
    ]);

    await page.screenshot({ path: "loginPage.png" });

    const csvCompanyInfo = [
      ["E-mail", "Company Name", "Contact Name", "Telephone", "Company url"]
    ];

    for (let linkIndex = 0; linkIndex < links.length; linkIndex++) {
      console.log(`parsing company info: ${linkIndex + 1} of ${links.length}`);
      try {
        const companyUri = links[linkIndex][0];
        console.log("Parsing company: ", companyUri);
        const companyDetails = await parseInfo(companyUri);
        console.log("COMPANY DETAILS: ", companyDetails);
        console.log("COMPANY INFO CSV ARR", csvCompanyInfo);

        let state = true;
        csvCompanyInfo.forEach(i => {
          if (i[0].includes(companyDetails[0]) === true) {
            state = false;
          }
        });
        if (state) csvCompanyInfo.push(companyDetails);
      } catch (err) {
        console.error(err);
      }
    }

    let set = new Set(csvCompanyInfo.map(JSON.stringify));
    let arr2 = await Array.from(set).map(JSON.parse);

    if (companiesParameter === "buyers") {
      await transformToCsv("buyerCompanies", arr2);
    } else if (companiesParameter === "sellers") {
      await transformToCsv("sellerCompanies", arr2);
    }

    await browser.close();
  } catch (e) {
    console.log("ERROR: ", e);
  }
}

// PARSE LINKS
async function parseLinks(uri) {
  const result = await page.evaluate(() => {
    const resultlist = document.querySelectorAll("td > .link");
    const links = [];
    for (let index = 0; index < resultlist.length; index++) {
      const element = resultlist[index];
      links.push(element.href);
    }
    return links;
  });

  console.log(result);
  return result;
}

// PARSE INFO
async function parseInfo(uri) {
  await preparePageForTests(page);

  await page.goto(uri);

  const result = await page.evaluate(() => {
    // Company details
    console.log(
      "-----------------------PARSING COMPANY INFO---------------------------"
    );

    let companyName = "";
    let contactName = "";
    let mail = "";
    let tel = "";
    let webAddress = "";

    const companyInfoBox = $($(".balken_markt_rot")[1]).parent();
    let a1 = $(companyInfoBox.children()[1]);

    // company name;
    try {
      companyNameTemp = $(
        a1.find("tbody > tr > td > table > tbody > tr > td >  b")[0]
      )
        .text()
        .replace(/,/g, " ");
    } catch (error) {
      console.error("Company name not found");
    }

    if (companyNameTemp.toString().includes("null.HYPE_element")) {
      companyName = "";
    } else {
      companyName = companyNameTemp;
    }

    // company contact name

    try {
      let a2 = $(
        a1.find(
          "tbody > tr > td > table > tbody > tr > td > table > tbody > tr"
        )[0]
      );
      let a3 = $(a2.find("td")[1]);
      contactNameTemp = $(a3.find("b"))
        .text()
        .replace(/,/g, " ");
    } catch (error) {
      console.error("Contact name not found for ", companyName);
    }

    if (contactNameTemp.toString().includes("null.HYPE_element")) {
      contactName = "";
    } else {
      contactName = contactNameTemp;
    }

    // company e-mail
    try {
      mailTemp = $(a1.find("tbody > tr > td > table > tbody > tr > td >  p")[3])
        .text()
        .replace(/,/g, " ");
    } catch (error) {
      console.error("E-mail not found for ", companyName);
    }

    if (mailTemp.toString().includes("null.HYPE_element")) {
      mail = "";
    } else {
      mail = mailTemp;
    }

    // company telephone number
    try {
      telTemp = $(
        a1.find("tbody > tr > td > table > tbody > tr > td >  span")[0]
      )
        .text()
        .replace(/,/g, " ");
    } catch (error) {
      console.error("Telephone number not found for ", companyName);
    }

    if (telTemp.toString().includes("null.HYPE_element")) {
      tel = "";
    } else {
      tel = telTemp;
    }

    //company url
    try {
      webAddressTemp = $(
        a1.find(
          "tbody > tr > td > table > tbody > tr > td >  span:contains('www')"
        )
      )
        .text()
        .replace(/,/g, " ");
    } catch (error) {
      console.error("Web address not found for", companyName);
    }

    if (webAddressTemp.toString().includes("null.HYPE_element")) {
      webAddress = "";
    } else {
      webAddress = webAddressTemp;
    }

    //console.log(companyName, contactName, mail, tel, webAddress);
    const companyDetails = [mail, companyName, contactName, tel, webAddress];
    return companyDetails;
  });

  //console.log(result);
  return result;
}

async function transformToCsv(fileName, csvData) {
  const myFile = fs.createWriteStream(fileName + ".csv");

  await transform(csvData, function(data) {
    //remove the following line
    data.push(data.shift());
    return data.join(",") + "\n";
  }).pipe(myFile);
}

module.exports = {
  scrapeLinks,
  scrapeInfo
};
