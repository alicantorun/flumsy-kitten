const argv = require("yargs")
  .option("scrapeBuyersLinks", {
    alias: "sbl",
    default: false
  })
  .option("scrapeSellersLinks", {
    alias: "ssl",
    default: false
  })
  .option("scrapeInfo", {
    alias: "si",
    default: false,
    nargs: 1,
    demand: true
  }).argv;
const fs = require("fs");
const parse = require("csv-parse");
const scraper = require("./scraper");

if (argv.scrapeBuyersLinks) {
  scraper.scrapeLinks("A");
} else if (argv.scrapeSellersLinks) {
  scraper.scrapeLinks("G");
} else if (argv.scrapeInfo) {
  let links;
  const parser = parse({ delimiter: "," }, function(err, data) {
    links = data;
  });

  const stream = fs
    .createReadStream(__dirname + `/${argv.scrapeInfo}Links.csv`)
    .pipe(parser);
  stream.on("end", () => {
    links.shift();
    console.log(links[0]);
    scraper.scrapeInfo(links, argv.scrapeInfo);
  });
}
