const csfd = require('csfd-api')
const fs = require('fs').promises;

const csfd_db_file = './csfd.json';
const csfd_sleep = 5000;

var csfdDb = require(csfd_db_file);

const waitFor = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
      await asyncForEach(Object.keys(csfdDb), async (name) => {
        
        let o = csfdDb[name];
        if (!csfdDb[name].imdbId)
        {
            console.log('Search for: ' + name)
            // search
            csfdDb[name].imdbId = await csfd.search(name)
              .then(res => {
                if (res.films && res.films.length>0)
                {
                    return res.films[0].id;
                }
                return null;
              })
              .catch(err => {
                console.error(err);
                return null;
              })
              
              
            saveCsfdDb(csfdDb);
            console.log('Id: ' + csfdDb[name].imdbId)
            
            await waitFor(csfd_sleep);
        }
        
        if (csfdDb[name].imdbId && !csfdDb[name].rank)
        {
            console.log('Get details: ' + name)
            // rank
            csfdDb[name].rank = await csfd.film(csfdDb[name].imdbId)
              .then(res => res.score)
              .catch(err => {
                console.error(err);
                return null;
              })
            
            saveCsfdDb(csfdDb);
            console.log('Score: ' + csfdDb[name].rank)
              
            await waitFor(csfd_sleep);
        } 
      });
      console.log('Done');
}

run();

async function saveCsfdDb(data)
{
    return await fs.open(csfd_db_file, 'w')
            .then(filehandle => filehandle.write(JSON.stringify(data)))
            .catch((err) => console.error(err));
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}