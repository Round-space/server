import bodyParser from 'body-parser';
import Moralis from 'moralis';
import {ethers} from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { toBuffer, bufferToHex, keccak256 } from 'ethereumjs-util';
import config from './config';
import fs from 'fs';
declare const Parse: any;
var SHA3_NULL_S = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';

var isHexStrict = function (hex: any) {
    return /^(-)?0x[0-9a-f]*$/i.test(hex);
};

function findEventNameByTopic(abi: any, topic: string) {
  for (const item of abi) {
      if (item.type === "event") {
          const types = item.inputs.map((input: any) => input.type);
          const eventSignature = ethers.id(`${item.name}(${types.join(",")})`);
          
          if (eventSignature === topic) {
              return [item.name, types];
          }
      }
  }

  return [null, null];
}

var sha3 = function (value: any) {
    var bufferValue;
    if (isHexStrict(value) && /^0x/i.test(value.toString())) {
        bufferValue = toBuffer(value);
    }
    else {
        // Assume value is an arbitrary string
        bufferValue = Buffer.from(value, 'utf-8');
    }
    var returnValue = bufferToHex(keccak256(bufferValue));
    if (returnValue === SHA3_NULL_S) {
        return null;
    }
    return returnValue;
};

const parseUpdate = async function(tableName: string, object: any) {
  // Check if object exists in db

  const query = new Parse.Query(tableName);
  query.equalTo('transaction_hash', object.transaction_hash);
  
  const result = await query.first({ useMasterKey: true });
  if (result) {
    // Loop through object's keys
    for (const key in object) {
      result.set(key, object[key]);
    }
    return result?.save(null, { useMasterKey: true });
  } else {
    // Create new object
    const newObject = new Parse.Object(tableName);
    for (const key in object) {
      newObject.set(key, object[key]);
    }
    return newObject.save(null, { useMasterKey: true });
  }
  
}

// Create a middleware function to log incoming request data
const customEventSync = (req: any, res: any, next: any) => {
    
    const jsonParser = bodyParser.json();
  
    jsonParser(req, res, (err) => {
      if (err) {
        console.error('Error while parsing request body:', err);
        res.status(500).send('Error while parsing request body');
        return;
      }
  
      // Access the parsed data from req.body
      // console.log('Received data at /streams:', req.body);
  
      var generatedSignature = sha3(JSON.stringify(req.body)+config.MORALIS_API_KEY);
      
      // Grab the 'x-signature' header value
      const signature = req.headers['x-signature'];
      if( !signature || !generatedSignature || signature !== generatedSignature ) {
        console.error('Invalid signature');
        res.status(400).send('Invalid signature');
        return;
      }
      try {
        if(req.body.abi?.length) {
          const decoded = Moralis.Streams.parsedLogs<any>(req.body)
          decoded.forEach((data: any, index: number) => {
            const confirmed = req.body.confirmed;
            
            const { topic0, transactionHash, logIndex } = req.body.logs[index];
            const [eventName, types] = findEventNameByTopic(req.body.abi, topic0);
            const cleanData = {} as any;
            Object.keys(data).forEach((key) => {
              if(data[key]._isBigNumber) {
                cleanData[key] = data[key].toString();
              } 
              // if is an array of bignumber
              else if(Array.isArray(data[key])) {
                cleanData[key] = data[key].map((item: any) => {
                  if(item._isBigNumber) {
                    return item.toString();
                  } else {
                    return item;
                  }
                });
              }
              else {
                cleanData[key] = data[key];
              }
            });

            try {
              parseUpdate(eventName, {
                ...cleanData,
                confirmed,
                transaction_hash: transactionHash,
                log_index: logIndex,
              });
            } catch (error) {
              console.error(error);
            }
          })

        }
      } catch (error) {
        console.error(error);
        res.status(500).send('Error while parsing request body');
      }

  
      // Send the 200 OK response
      res.status(200).send('OK');
    });
  };

  export default customEventSync;