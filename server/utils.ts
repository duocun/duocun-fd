import { Request, Response } from "express";
import https from 'https';
import crypto from 'crypto';
import { IncomingMessage } from "http";
import { Config } from "./config";

export class Utils {
  cfg: any;

  constructor() {
    this.cfg = new Config();// JSON.parse(fs.readFileSync('../duocun.cfg.json', 'utf-8'));
  }

  genWechatToken(req: Request, res: Response) {
    let token = 'testToken20';
    let timestamp = req.query.timestamp;
    let nonce = req.query.nonce;
    let signature = req.query.signature;
    let echostr = req.query.echostr;
    let list = [token, timestamp, nonce].sort();
    let sha1 = crypto.createHash('sha1');
    let s = list.join('');
    let hash = sha1.update(s).digest('hex');
    console.log(hash);
    if (hash === signature) {
      res.send(echostr);
    } else {
      res.send('');
    }
  }

  getGeocode(req: Request, res: Response) {
    let key = this.cfg.GEOCODE_KEY;
    const latlng = (req.query.lat && req.query.lng) ? (req.query.lat + ',' + req.query.lng) : '';
    const addr = req.query.address;
    let url = 'https://maps.googleapis.com/maps/api/geocode/json?sensor=false&key=' + key;
    if (latlng) {
      url += '&latlng=' + latlng;
    } else if (addr) {
      url += '&address=' + addr;
    }
    https.get(url, (res1: IncomingMessage) => {
      let data = '';
      res1.on('data', (d) => {
        // process.stdout.write(d);
        data += d;
        // console.log('receiving: ' + d);
      });

      res1.on('end', () => {
        // console.log('receiving done!');
        if (data) {
          const s = JSON.parse(data);
          if (s.results && s.results.length > 0) {
            res.send(s.results[0]);
          } else {
            res.send();
          }
        } else {
          res.send('');
        }
      });
    });
  }

  getPlaces(req: Request, res: Response) {
    let key = this.cfg.GOOGLE_PLACE_KEY;
    // let location = req.query.lat + ',' + req.query.lng;
    let input = req.query.input;
    let url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json?input=' + input + '&key=' + key
      + '&location=43.761539,-79.411079&radius=100';
    https.get(url, (res1: IncomingMessage) => {
      let data = '';
      res1.on('data', (d) => {
        // process.stdout.write(d);
        data += d;
        // console.log('receiving: ' + d);
      });

      res1.on('end', (rr: any) => {
        // console.log('receiving done!');
        if (data) {
          const s = JSON.parse(data);
          if (s.predictions && s.predictions.length > 0) {
            res.send(s.predictions);
          } else {
            res.send();
          }
        } else {
          res.send('');
        }
      });
    });
  }

  getRoadDistances(req: Request, res: Response) {
    let key = this.cfg.GOOGLE_DISTANCE_KEY;
    let origin = req.body.origins[0]; // should be only one location
    let sOrigin = `${origin.lat},${origin.lng}`;
    let malls = req.body.destinations;
    let destinations: any[] = [];
    req.body.destinations.map((d: any) => {
      destinations.push(`${d.lat},${d.lng}`);
    });
    let sDestinations = destinations.join('|');

    let url = 'https://maps.googleapis.com/maps/api/distancematrix/json?region=ca&origins=' + sOrigin + '&destinations=' + sDestinations + '&key=' + key;

    https.get(url, (res1: IncomingMessage) => {
      let data = '';
      res1.on('data', (d) => {
        // process.stdout.write(d);
        data += d;
        // console.log('receiving: ' + d);
      });

      res1.on('end', (rr: any) => {
        // console.log('receiving done!');
        if (data) {
          const s = JSON.parse(data);
          const rows = s.rows;
          if (rows && rows.length > 0 && rows[0].elements && rows[0].elements.length > 0) {
            const elements = rows[0].elements;
            for (let i = 0; i < destinations.length; i++) {
              elements[i].id = malls[i].id;
              elements[i].workers = malls[i].workers;
              elements[i].name = malls[i].name;
              elements[i].type = malls[i].type;
              elements[i].origin = origin;
              elements[i].destination = destinations[i];
            }
            res.send(elements);
          } else {
            res.send('');
          }
        } else {
          res.send('');
        }
      });
    });
  }

  getAddrStringByPlace(place: any) {
    const terms = place.terms;
    if (terms && terms.length >= 4) {
      return terms[0].value + ' ' + terms[1].value + ', ' + terms[2].value + ', ' + terms[3].value + ', ' + terms[4].value;
    } else {
      return '';
    }
  }
}