const http = require('http');
const fs = require('fs').promises;
const parser = require('fast-xml-parser');

const tv_data_url = 'http://televize.sh.cvut.cz/xmltv/all.xml.php';
const tv_data_cache_file = 'data.xml';
const tv_data_cache_timeout = 1 * 60 * 60 * 1000;
const tv_data_channels = [513, 514, 773, 770, 2050, 780, 774, 779, 788, 2052, 515, 517, 518, 801];

const tv_data_exclude = ['MotoGP'];

const csfd_db_file = './csfd.json';

var csfdDb = require(csfd_db_file);

async function run()
{
     console.log('x');
     var data = await getTvData();
     console.log(data);
     var html = '';
     data.forEach(channel => {
        var channelHtml = '<div class="channel"><div class="title">'+channel.name+'</div>';
            channel.shows.sort((a, b) => a.timestamp - b.timestamp).forEach(show => {
               channelHtml += '<div class="show">'+show.dateStart+'<br>'+show.name+'</div>';
            })
        html += channelHtml + '</div>';
     })

     saveHtml(html);
}

run();


async function saveHtml(html)
{
    header = await fs.open('html_header.html', 'r').then(filehandle => filehandle.readFile()).catch((err) => console.error(err)); 
    footer = await fs.open('html_header.html', 'r').then(filehandle => filehandle.readFile()).catch((err) => console.error(err));
    
    await fs.open('output.html', 'w').then(filehandle => filehandle.write(header+html+footer));
    
}

async function getTvData()
{
    var xml = null;
    

    // check cache file mtime
    var mtime = await getFileMtime(tv_data_cache_file);
    
    // if we need new data ...
    if ((new Date().getTime() - mtime) > tv_data_cache_timeout)
    {
        console.log('Downloading new data ...');
        xml = await getContent(tv_data_url)  
                    .then(_xml => fs.open(tv_data_cache_file, 'w').then(filehandle => { filehandle.write(_xml); return _xml; }))
                    .catch((err) => console.error(err));
        
    }
    else
    {
        xml = await fs.open(tv_data_cache_file, 'r')
            .then(filehandle => filehandle.readFile())
            .catch((err) => console.error(err));
    }
    
    
    // xml to json
    
    var jsonObj = null;
    try{
        var options = {
            
            ignoreAttributes : false,
            parseAttributeValue : true,

        };

      jsonObj = parser.parse(xml.toString(), options);
    }catch(error){
      console.log(error.message)
    }
    
    // transform data
    if (jsonObj)
    {
        var channels = jsonObj.tv.channel.map(i => ({ id: i['@_id'], name: i['display-name'], shows: []}));
        var channels = jsonObj.tv.channel.filter(i => tv_data_channels.indexOf(parseInt(i['@_id'].split('.')[0])) != -1).map(i => ({ id: i['@_id'], name: i['display-name'], shows: []}));
        
        jsonObj.tv.programme.forEach(p => {
            if (tv_data_channels.indexOf(parseInt(p['@_channel'].split('.')[0])) != -1)
            {
              // name cleanup
              let name = p['title']['#text'];
              
              // remove -ST -W -HD -AD"
              name = name.replace(/ \-([A-Z]+)/g, '').trim()
              
              // remove (123) from end
              name = name.replace(/\([0-9,\- ]+\)$/, '').trim()
              
              // remove IV from end
              name = name.replace(/ ([IVX]+)$/, '').trim()
              
              let rank = null;
              
              // check rank
              if (typeof csfdDb[name] === 'undefined')
              {
                  csfdDb[name] = { 
                    rank: null, 
                    timestmap: null, 
                    csfdId: null, 
                }
              }
              else if (csfdDb[name].rank)
              {
                  rank = csfdDb[name].rank                 
              }
              
              
              channels.find(ch => ch.id ==  p['@_channel']).shows.push({
                  name: p['title']['#text'],
                  rank: rank,
                  dateStart: p['@_start'],
                  dateEnd: p['@_end']
              })
            } 
        })
        
        console.log(Object.keys(csfdDb).length);
        
        // save db
        await saveCsfdDb(csfdDb);
         
        return channels; 
    }
    
    return jsonObj;
    
    
}

async function saveCsfdDb(data)
{
    return await fs.open(csfd_db_file, 'w')
            .then(filehandle => filehandle.write(JSON.stringify(data)))
            .catch((err) => console.error(err));
}

async function getFileMtime(file)
{
    return await fs.stat(tv_data_cache_file)
        .then(s => s.mtimeMs)
        .catch(e => { 
            if (e.code=='ENOENT') { 
                console.log('Cache file not found') 
            }
            else {
                console.error(e)
            }
            return 0;  
        });
}  

const getContent = function(url) {
  // return new pending promise
  return new Promise((resolve, reject) => {
    // select http or https module, depending on reqested url
    const lib = url.startsWith('https') ? require('https') : require('http');
    const request = lib.get(url, (response) => {
      // handle http errors
      if (response.statusCode < 200 || response.statusCode > 299) {
         reject(new Error('Failed to load page, status code: ' + response.statusCode));
       }
      // temporary data holder
      const body = [];
      // on every content chunk, push it to the data array
      response.on('data', (chunk) => body.push(chunk));
      // we are done, resolve promise with those joined chunks
      response.on('end', () => resolve(body.join('')));
    });
    // handle connection errors of the request
    request.on('error', (err) => reject(err))
    })
};