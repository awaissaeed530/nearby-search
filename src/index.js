import axios from 'axios'
import fs from 'node:fs'
import { stringify } from 'csv'
import { config } from 'dotenv'

config()

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY
if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Please provide google maps API key")
}
const BONN_LOCATION = "50.703577%2C7.1172997"

async function sleep(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

async function nearbySearch(location, radius, pageToken) {
    let uri = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${GOOGLE_MAPS_API_KEY}`
    if (pageToken) {
        uri += `&pagetoken=${pageToken}` 
    } else {
        uri += `&location=${location}&radius=${radius}&type=restaurant`
    }
    return axios.get(uri)
        .then((res) => res.data)
        .catch((err) => console.log(err))
}

async function loadPlaces() {
    let nextPageToken
    let count = 1
    const results = []
    do {
        console.log("Run: ", count)
        const nearby = await nearbySearch(BONN_LOCATION, 50_000, nextPageToken)

        console.log(`Data recieved: ${nearby.results.length} entries`)
        results.push(...nearby.results)

        nextPageToken = nearby.next_page_token
        count += 1

        if (nextPageToken) {
            console.log("Recieved next_page_token, will search for new results...")
            console.log("Waiting 5 sec before next request\n")
            await sleep(5000)
        } else {
            console.log("next_page_token not recieved, will stop execution")
        }
    } while (nextPageToken)

    fs.writeFileSync("data.json", Buffer.from(JSON.stringify(results)), 'utf8') 
    console.log("Data written to file")
}

function mapToCsv(jsonPath) {
    const json = fs.readFileSync(jsonPath, { encoding: 'utf8' })
    const results = JSON.parse(json)
    console.log(`Loaded ${results.length} entries`)

    const writableStream = fs.createWriteStream("data.csv");
    const columns = [
        "name",
        "vicinity",
        "plus_code",
        "user_ratings_total",
        "rating",
        "place_id",
    ];
    const stringifier = stringify({ header: true, columns })

    results
        .filter((res) => res.business_status === 'OPERATIONAL')
        .map((res) => ({
            name: res.name,
            vicinity: res.vicinity,
            plus_code: res.plus_code.compound_code,
            user_ratings_total: res.user_ratings_total,
            rating: res.rating,
            place_id: res.place_id,
        }))
        .forEach((res) => stringifier.write(res))
    stringifier.pipe(writableStream);
    console.log("data.csv has been written")
}

console.log("Loading places")
await loadPlaces()

console.log("\nCreating CSV")
mapToCsv("data.json")
