const mongodb = require('mongodb');
const ObjectId = mongodb.ObjectID;
const googleMaps = require('@google/maps');

const config = require('./config.json');



async function main() {
  const _init = await init();

  const db = _init.db;
  const geocoder = _init.geocoder;

  run(db, geocoder);
}

/**
 * Function used to establish the connection to the
 * database, and init the google maps API.
 * 
 */
async function init() {

  // connect to the database.
  const mongoConnect = new Promise((resolve, reject) => {
    if(config.database) {
      mongodb.connect(config.database, (err, db) => {
        if (err) {
          throw err;
        }
        else {
          resolve(db.db('venues'));
        }
      });
    }
    else {
      throw 'No database specified in config.json';
    }
  })

  // run db connect.
  const db = await mongoConnect;

  // Create tge google maps client.
  const gClient = googleMaps.createClient({
    key: config.googleMapsKey
  });

  return {db: db, geocoder: gClient.geocode};

}

/**
 * Function used to run the migration.
 * 
 */
async function run(db, geocoder) {

  // Load the venues from the database.
  console.log('Loading venues from database.');
  try {
    const venues = await db.collection('venue').find({});
    if(venues.length > 0) {
      console.log('found ' + venues.length + ' venues.'); 
      for(let venue of venues) {
        
        // check if the venue already has already been migrated.
        if(venue.latLng) {
          console.log('Venue ' + venue.name + ' has already been migrated.');
        }
        else {
          console.log('GeoCoding ' + venue.name);

          // Allow the address line 2 field to be empty.
          if(!venue.address.line2) {
            venue.address.line2 = ' ';
          }

          // Generate the long address string for the venue.
          const venueAddressString = venue.address.line1 + ', ' + venue.address.line2 + ', ' + venue.address.city + ', ' +  venue.address.country + ', ' + venue.address.postCode;
          geocoder({
            address: venueAddressString

          }, async function(err, response) {
            console.error.log(response.json.results);

            // Save the response to the database.
            await db.collection('venue').update({
              _id: objectId(venue._id)
            }, {
              $set: {
                latLng: response.json.results
              }
            });

            console.log(venue.name + ' Completed. ')

          });
        }

      }

    }
    else {
      console.error('Could not find any venues in database.');
    }
  }
  catch(error) {
    throw new Error(error);
  }

}

main();

