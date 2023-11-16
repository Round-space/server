import Moralis from "moralis";
declare const Parse: any;

Parse.Cloud.define("getTokenBalances", async function(request: any) {
    const address = request.params.address;
    const chain = request.params.chain;
    return await Moralis.EvmApi.token.getWalletTokenBalances({
        chain,
        "tokenAddresses": [],
        address
      });
});

Parse.Cloud.define("getTokenPrice", async function(request: any) {
    const address = request.params.address;
    const chain = request.params.chain;
    return await Moralis.EvmApi.token.getTokenPrice({
        chain,
        address
      });
});
    

const lookups = [

    // only transfers to or from userAddress
    //{match: {$expr: {$eq: ["$from_address", bountyId]} } },
    //  {$eq: ["$to_address", userAddress]},
    //]}}},
  
    // join to Token collection on token_address
    {
        lookup: {
            from: "BountyIssued",
            localField: "extId",
            foreignField: "transaction_hash",
            as: "bountyIssued"
        }
    },
  
    {
        lookup: {
            from: "BountyFulfilled",
            localField: "bountyId",
            foreignField: "bountyId",
            as: "submissions"
        }
    },
    {
        lookup: {
            from: "FulfillmentAccepted",
            localField: "bountyId",
            foreignField: "bountyId",
            as: "fulfillments"
        }
    },
    {
        lookup: {
            from: "ActionPerformed",
            localField: "bountyId",
            foreignField: "bountyId",
            as: "actions"
        }
    },
  
  ];

  Parse.Cloud.define("uploadToIPFS", async function(request: any) {
    const filename = request.params.filename;
    const base64 = request.params.base64;

    return await Moralis.EvmApi.ipfs.uploadFolder({
        abi: [
            {
                path: filename,
                content: base64
            }
        ]
    });
  })
  

  Parse.Cloud.define("getBountyByBountyId", function(request: any) {
    const bountyId = request.params.bountyId;
    const query = new Parse.Query("Bounty");
    query.equalTo("bountyId", bountyId);
    const pipeline = lookups;
    return query.aggregate(pipeline);
  });
  
  
  Parse.Cloud.define("getBountyByObjectId", function(request: any) {
    const lookups = [
  
        // only transfers to or from userAddress
        //{match: {$expr: {$eq: ["$from_address", bountyId]} } },
        //  {$eq: ["$to_address", userAddress]},
        //]}}},
  
        // join to Token collection on token_address
        {
            lookup: {
                from: "BountyIssued",
                localField: "extId",
                foreignField: "transaction_hash",
                as: "bountyIssued"
            }
        },
        {
            lookup: {
                from: "BountyFulfilled",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "submissions"
            }
        },
        {
            lookup: {
                from: "BountyMetaFulfilled",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "metasubmissions"
            }
        },
        {
            lookup: {
                from: "FulfillmentAccepted",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "fulfillments"
            }
        },
        {
            lookup: {
                from: "BountyDrained",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "bountyDrained"
            }
        },
        {
            lookup: {
                from: "ActionPerformed",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "actions"
            }
        },
        {
            lookup: {
                from: "AccountMetadata",
                let: { creatorAddress: "$creatorAddress" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$account", "$$creatorAddress"]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            themeColor: 1
                        }
                    }
                ],
                as: "accountMetadata"
            }
        }
  
    ];
    const objectId = request.params.objectId;
    const query = new Parse.Query("Bounty");
    query.equalTo("objectId", objectId);
    const pipeline = lookups
    return query.aggregate(pipeline);
  });
  
  
  Parse.Cloud.define("getBrokenBounties", function(request: any) {
    const bountyId = request.params.bountyId;
    const query = new Parse.Query("Bounty");
    query.equalTo("bountyId", undefined);
    const pipeline = lookups;
    return query.aggregate(pipeline);
  });
  
  
  Parse.Cloud.beforeSave("BountyIssued", async function(request: any) {
    // const logger = Parse.Cloud.getLogger();
    // logger.info('Running beforeSave BountyIssued... with request' + JSON.stringify(request))
    const txId = request.object.get('transaction_hash');
    const data = request.object.get('data');
    const bountyId = request.object.get('bountyId');
    const query = new Parse.Query('Bounty');
    const confirmed = request.object.get('confirmed');
    // query.equalTo('extId', txId)
    query.equalTo('metadataUrl', 'https://gateway.moralisipfs.com/ipfs/' + data + '/newbounty.json');
  
    // logger.info('Trying to Get Bounty with ExtId:' + txId);
    // logger.info('Trying to Get Bounty with metadata hash:' + data);
    const queryResults = await query.find({ useMasterKey: true });
    // logger.info('Query Results' + queryResults.length);
    if (queryResults.length > 0) {
        const bounty = queryResults[0];
        // logger.info("attempting to fix bounty:" + JSON.stringify(bounty));
        bounty.set("bountyId", bountyId);
        bounty.set("extId", txId);
  
        const creator = bounty.get('creatorAddress');
        
        // // find AccountMetadata that has the account same as creator, and all the BoardSubscriptions where board is the same as objectId of the AccountMetadata, and the email from the Users table where userId is the same as the userId of the BoardSubscription and user's emailVerified is true, using pipeline and aggregate
        const query = new Parse.Query('AccountMetadata');
        query.equalTo('account', creator);
  
        // get the objectId of the AccountMetadata
        const accountMetadata = await query.first({ useMasterKey: true });
        const accountMetadataId = accountMetadata.id;
  
        // find BoardSubscriptions that has board same as objectId of the AccountMetadata, get only the user field
        const query2 = new Parse.Query('BoardSubscription');
        query2.equalTo('board', accountMetadataId);
        query2.select('user');
  
        // list of users that are subscribed to the board
        const boardSubscriptions = await query2.find({ useMasterKey: true });
        const userIds = boardSubscriptions.map((boardSubscription : any) => boardSubscription.get('user'));
  
        // find Users that has ethAddress in the list of userIds, and emailVerified is true, get only the email field
        const query3 = new Parse.Query('_User');
        query3.containedIn('ethAddress', userIds);
        query3.equalTo('emailVerified', true);
        query3.select('email');
  
        // // log the email addresses
        const emailResults = await query3.find({ useMasterKey: true });
        const emails = emailResults.map((emailResult : any) => emailResult.get('email'));
        
  
        const config = await Parse.Config.get();
        const url = config.get("public_url");
        const bountyName = bounty.get('name');
        if(confirmed) {
            emails.forEach(async (email : any, index: number) => {
                // logger.info("sending email to:" + email);
                Parse.Cloud.sendEmail({
                    to: email,
                    templateId: "d-1b3141aa245e4c50a4b434c33812f42f",
                    dynamic_template_data: {
                        link: url+'bounty/'+bounty.id,
                        board: url+'board/'+creator,
                        title: bountyName,
                    }
                });
            });
        }
  
        const result = await bounty.save(null,{ useMasterKey: true });
    //   logger.info(JSON.stringify(result))
    }else{
        // logger.info("didnt find bounty with extId:" + txId);    
        // logger.info("didnt find bounty with metadata hash:" + data);    
    }
  
  });
  
  
  Parse.Cloud.define("getAllBounties", async function(request: any) {
  
    const pageSize = 12;
    const page =  request.params.page ? Number.parseInt(request.params.page) - 1 : 0;
    const account = request.params.creator ? request.params.creator : null;
    
    if(!account){
        return []
    }
    
  
    const dashboard = request.params.dashboard ? request.params.dashboard : false;
    
    
    // hide drafts in the public board, if the option is set
    let hideDrafts = false;
    if( !dashboard ) {
        const acQuery = new Parse.Query("AccountMetadata");
        acQuery.equalTo('account', account, 'i');
        const acResult =  await acQuery.find();
        hideDrafts = acResult?.[0]?.get('hideDrafts');
    }
  
    const skipAmount =  page*pageSize ;
    const pipeline = [
        {
            lookup: {
                from: "BountyIssued",
                localField: "extId",
                foreignField: "transaction_hash",
                as: "bountyIssued"
            }
        },
        {
            lookup: {
                from: "BountyFulfilled",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "submissions"
            }
        },
        {
            lookup: {
                from: "BountyMetaFulfilled",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "metasubmissions"
            }
        },
        {
            lookup: {
                from: "FulfillmentAccepted",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "fulfillments"
            }
        },
        {
            lookup: {
                from: "ContributionAdded",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "contributions"
            }
        },
        {
            lookup: {
                from: "BountyDrained",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "bountyDrained"
            }
        },
        {
            lookup: {
                from: "ActionPerformed",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "actions"
            }
        },
        {sort : { "_updated_at" : -1}},
        { skip : skipAmount},
        { limit : pageSize},
  
    ];
  
    const query = new Parse.Query("Bounty");
    
    query.matches('creatorAddress', account,'i');
  
    if(hideDrafts){
        query.exists('extId');
        query.exists('metadataUrl');
    }
    
    return query.aggregate(pipeline);
  });
  
  Parse.Cloud.define("getAllUserBounties", async function(request: any) {
  
    const account = request.params.creator ? request.params.creator : null;
    // const userAddress = request?.user?.get('ethAddress');
    const dashboard = request.params.dashboard ? request.params.dashboard : false;
  
    // hide drafts in the public board, if the option is set
    let hideDrafts = false;
    if( !dashboard ) {
        const acQuery = new Parse.Query("AccountMetadata");
        acQuery.equalTo('account', account, 'i');
        const acResult =  await acQuery.find();
        hideDrafts = acResult?.[0]?.get('hideDrafts');
    }
  
    const pipeline = [
        {
            lookup: {
                from: "BountyIssued",
                localField: "extId",
                foreignField: "transaction_hash",
                as: "bountyIssued"
            }
        },
        {
            lookup: {
                from: "BountyFulfilled",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "submissions"
            }
        },
        {
            lookup: {
                from: "BountyMetaFulfilled",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "metasubmissions"
            }
        },
        {
            lookup: {
                from: "BountyFulfilled",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "chainFullfillments"
            }
        },
        {
            lookup: {
                from: "FulfillmentAccepted",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "fulfillments"
            }
        },
        {
            lookup: {
                from: "ContributionAdded",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "contributions"
            }
        },
        {
            lookup: {
                from: "BountyDrained",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "bountyDrained"
            }
        },
        {
            lookup: {
                from: "ActionPerformed",
                localField: "bountyId",
                foreignField: "bountyId",
                as: "actions"
            }
        },
        {sort : { bountyId : -1}},
  
    ];
  
    const query = new Parse.Query("Bounty");
    if(account){
        query.matches('creatorAddress', account,'i');
  
        if(hideDrafts){
            query.exists('extId');
            query.exists('metadataUrl');
        }
    }
    return query.aggregate(pipeline);
  });
  
  
  
  Parse.Cloud.define("getAccountMetadata", async function(request: any) {
    const account = request.params.account ? request.params.account : null;
    const query = new Parse.Query("AccountMetadata");
    if(account){
        query.matches('account', account,'i');
    }
    const result =  await  query.find();
    return result;
  });
  
  Parse.Cloud.define("getUserBountiesCount", async function(request: any) {
    const account = request.params.creator ? request.params.creator : null;
    if(!account){
        return 0;
    }
    const dashboard = request.params.dashboard ? request.params.dashboard : false;
    
    // hide drafts in the public board, if the option is set
    let hideDrafts = false;
    if( !dashboard ) {
        const acQuery = new Parse.Query("AccountMetadata");
        acQuery.equalTo('account', account, 'i');
        const acResult =  await acQuery.find();
        hideDrafts = acResult?.[0]?.get('hideDrafts');
    }
    
    const query = new Parse.Query("Bounty");
  
    query.equalTo('creatorAddress', account, 'i');
    
    if(hideDrafts){
        query.exists('extId');
        query.exists('metadataUrl');
    }
  
  
    const result =  await  query.count();
    return result;
  });
  
  Parse.Cloud.define("acceptBountyApplication", async function(request: any) {
  
    const bountyId = request.params?.['bountyId'];
    
    const account = request.user.get('ethAddress');
  
    const applicationId = request.params?.['applicationId'];
    const applicant = request.params?.['applicant'];
  
    if( !bountyId || !account || !applicationId || !applicant ) {
        throw new Error("Invalid parameters or user not logged in");
    }
  
    const query = new Parse.Query("Bounty");
  
    query.equalTo('objectId', bountyId)
    
    const queryResults = await query.find()
    
    const bounty = queryResults?.[0];
  
    if(!bounty) {
        throw new Error("Bounty not found");
    }
  
    const creator = bounty.get('creatorAddress');
  
    if(creator.toLowerCase() !== account.toLowerCase()) {
        throw new Error("Only the creator can accept the application");
    }
    
    bounty.addUnique( 'acceptedApplications', {
        applicationId,
        applicant
    })
  
    // get bountyApplication
    const applicationQuery = new Parse.Query("BountyApplication");
    applicationQuery.equalTo('objectId', applicationId)
  
    const applicationQueryResults = await applicationQuery.find()
    const application = applicationQueryResults?.[0];
  
    if(application) {
        // get email
        const email = application.get('email');
        
        // logger.info('application being accepted, and informing ' + email);
        
        if( email ) {
            const config = await Parse.Config.get();
            const url = config.get("public_url");
            Parse.Cloud.sendEmail({
                to: email,
                templateId: "d-fd5144142aca42b0b4aabea18950cab0",
                dynamic_template_data: {
                    link: url+'bounty/'+bounty.id,
                    title: bounty.get('name'),
                }
            });
        }
    }
  
      
    return await bounty.save(null, { useMasterKey: true });
  
  });
  
  Parse.Cloud.beforeSave("FulfillmentAccepted", async (request: any) => {
    
    const bountyId = request.object.get('bountyId');
    const fulfillmentId = request.object.get('fulfillmentId');
    const confirmed = request.object.get('confirmed');
    // logger.info('fulfillmentAccepted event for bountyId ' + bountyId + ' and fulfillmentId ' + fulfillmentId);
    const amounts = request.object.get('tokenAmounts');
  
    if( bountyId && fulfillmentId !== undefined ) {
        
        const query = new Parse.Query("BountyFulfilled");
        
  
        query.equalTo('bountyId', `${bountyId}`);
        query.equalTo('fulfillmentId', `${fulfillmentId}`);
        
        // use master key to bypass ACL
        // const queryResults = await query.find({ useMasterKey: true })
        // also find from the BountyMetafulfilled table all the records that have ipfsHash as substring in the data field of the bountyfulfilled table
        const queryResults = await query.find()
  
  
        const bountyFulfilled = queryResults?.[0];
  
        if(bountyFulfilled) {
  
            
  
            // const fulfillers = bountyFulfilled.get('fulfillers');
            const ipfsHashes = bountyFulfilled.get('data')?.split(',') || [];
            const transaction_hash = bountyFulfilled.get('transaction_hash');
  
            // query BountyMetaFulfilled table for the records that have ipfsHash in the ipfsHashes array
            const metaQuery = new Parse.Query("BountyMetaFulfilled");
            metaQuery.containedIn('ipfsHash', ipfsHashes);
            const metaQueryResults = await metaQuery.find();
            const emails = {} as any;
  
            metaQueryResults.forEach( (meta : any) => {
                const email = meta.get('email');
                const ipfsHash = meta.get('ipfsHash');
                emails[ipfsHash] = email;
            });
            // logger.info('emails');
            // logger.info(JSON.stringify(emails));
  
            // logger.info('ipfsHashes');
            // logger.info(JSON.stringify(ipfsHashes));
  
            // query bounty to get its title and link
            const bountyQuery = new Parse.Query("Bounty");
            bountyQuery.equalTo('bountyId', bountyId)
            
            const queryResults = await bountyQuery.find()
            
            const bounty = queryResults?.[0];
  
            const config = await Parse.Config.get();
            const url = config.get("public_url");
            const explorer = config.get("explorer");
            if(confirmed) {
                ipfsHashes.forEach( (ipfsHash : any, index : number) => {
                    // send email to the fulfiller
                    const email = emails[ipfsHash];
    
                    if(email) {
                        
                        // logger.info('sending email');
    
    
                        Parse.Cloud.sendEmail({
                            to: email,
                            templateId: "d-9eb33c79774043d395f70b61a0381c53",
                            dynamic_template_data: {
                                link: url + 'bounty/' + bounty.id,
                                title: bounty.get('name'),
                                explorer: explorer + 'tx/' + transaction_hash
                            }
                        });
                    }
                });
            }
        }
    }
  
  });
  
  Parse.Cloud.beforeSave("BountyApplication", async (request: any) => {
    const bountyId = request.object.get('bountyId');
  
    if( bountyId ) {
  
        const query = new Parse.Query("Bounty");
        query.equalTo('bountyId', bountyId)
        
        const queryResults = await query.find()
        
        const bounty = queryResults?.[0];
  
        if(!bounty) {
            throw new Error("Bounty not found");
        }
  
        const deadline = bounty.get('applicationsDeadline');
  
        let email = bounty.get('email');
  
        if( ! email ) {
            // check if the board has an email specified
            const creator = bounty.get('creatorAddress');
            const query = new Parse.Query("AccountMetadata");
            query.equalTo('account', creator)
  
            const queryResults = await query.find()
  
            const accountMetadata = queryResults?.[0];
  
            if( accountMetadata ) {
                email = accountMetadata.get('email');
            }
        }
  
        if( email ) {
            const config = await Parse.Config.get();
            const url = config.get("public_url");
  
            Parse.Cloud.sendEmail({
                // from: 'gagan@lab0324.xyz',
                to: email,
                templateId: "d-c62a815fd6bd4906a218bad703e67591",
                dynamic_template_data: {
                    link: url + 'bounty/'+bounty.id,
                    title: bounty.get('name'),
                }
              });
  
              // logger.info('found and attempted to send email to ' + email);
        } else {
            // logger.info('email not found');
        }
  
        if( deadline && deadline * 1000 < Date.now() ) {
            throw new Error("Applications deadline has passed");
        }
  
    }
    
    // implement public read, but no write access. This is to prevent data from being modified even by the submitter
    const acl = new Parse.ACL();
    acl.setPublicReadAccess(true);
    request.object.setACL(acl);
  
    request.object.set("applicant", request.user.get('ethAddress'));
  });
  
  Parse.Cloud.beforeSave("Bounty", async (request: any) => {
    
    // if the callee is using the master key, then we don't need to do anything
    if (request.master) {
        return;
    }
  
    const account = request.user.get('ethAddress');
    
    const objectId = request.object.id;
    
    if( objectId ) {
        const query = new Parse.Query("Bounty");
        query.equalTo('objectId', objectId)
        
        const queryResults = await query.find()
        
        // this condition is for backwards compatibility for old bounties, that do not have 'owners' column 
        if(queryResults?.[0] && queryResults[0].get('creatorAddress')?.toLowerCase() !== account.toLowerCase()) {
  
            // query the table BoardCollaborators to find where address is the same as the account and board is the same as the creatorAddress
            const query2 = new Parse.Query("BoardCollaborators");
            query2.equalTo('address', account)
            query2.equalTo('board', queryResults[0].get('creatorAddress'))
  
            const queryResults2 = await query.find()
  
            // if the query returns no results, then the user is not a collaborator
            if(!queryResults2?.[0]) {
                // logger.info('No Access');
                throw new Error('No Access');
  
            }
  
            // // this checks if the user is among the assigned owners of the bounty
            // const owners = queryResults[0].get('owners');
            // if(!owners?.[0] || undefined === owners.find( owner => owner.toLowerCase() === account.toLowerCase())) {
            //     logger.info('Not the same account');
            //     throw new Error('Not the same account');    
            // }
            
        }
  
        if(queryResults?.[0]?.get('extId')) {
            // logger.info('Trying to update a bounty that has already been issued');
            throw new Error('Trying to update a bounty that has already been issued');
        }
    }
    
  });
  
  Parse.Cloud.define("voteOnSubmission", function(request: any) {
    // if not logged in, then return
    if(!request.user) {
        return;
    }
  
    const user = request.user.get('ethAddress').toLowerCase();
    const bountyId = request.params.bountyId;
    const submissionId = request.params.submissionId;
  
    const query = new Parse.Query("SubmissionVote");
    query.equalTo('bountyId', bountyId);
    query.equalTo('user', user);
  
    return query.first().then( async (queryResult : any) => {
  
        if(queryResult) {
            const oldVote = queryResult.get('submissionId');
            const result = await queryResult.destroy({useMasterKey: true});
            if(oldVote === submissionId) {
                return result;
            }
        }
  
        const SubmissionVote = Parse.Object.extend("SubmissionVote");
        const submissionVote = new SubmissionVote();
        submissionVote.set('bountyId', bountyId);
        submissionVote.set('user', user);
        submissionVote.set('submissionId', submissionId);
        return submissionVote.save(null, {useMasterKey: true});
    });
  });
  
  // this is to prevent the user from voting on a submission, because voting is being handled by the cloud function above
  Parse.Cloud.beforeSave("SubmissionVote", async (request: any) => {
    
    // if the callee is not using the master key, throw an error
    if (!request.master) {
        throw new Error('Not authorized');
    }
  
    const bountyId = request.object.get('bountyId');
  
    // query bounty with the object id same as the bountyId to get the voting, votingStart and votingEnd
    const query = new Parse.Query("Bounty");
    
    query.equalTo('objectId', bountyId);
  
    const result = await query.first();
  
    if(!result) {
        throw new Error('Bounty not found');
    }
  
    const voting = result.get('voting');
    const votingStart = result.get('votingStart');
    const votingEnd = result.get('votingEnd');
  
    if(voting && votingStart && votingEnd) {
        // get current time in seconds
        const time = new Date().getTime();
        const currentTime = Math.floor(time / 1000);
  
        // if current time is  between voting start and end
        if(currentTime >= votingStart && currentTime <= votingEnd) {
            return;
        } else if(currentTime < votingStart) {
            throw new Error('Voting has not started');
        } else if(currentTime > votingEnd) {
            throw new Error('Voting has ended');
        }
    } else {
        throw new Error('Voting is not enabled');
    }
  });
  
  Parse.Cloud.beforeDelete("SubmissionVote", async (request: any) => {
    // if the callee is not using the master key, throw an error
    if (!request.master) {
        throw new Error('Not authorized');
    }
  });
  
  Parse.Cloud.define("myVote", async function (request: any) {
    
    const objectId = request.params.objectId;
    const user = request.params.address?.toLowerCase();
    
    // const user = request.user.get('ethAddress').toLowerCase();
    const query = new Parse.Query("SubmissionVote");
    query.equalTo('bountyId', objectId);
    query.equalTo('user', user);
    const result = await query.first();
    if(result) {
        return result.get('submissionId');
    } else {
        return null;
    }
  })
  
  Parse.Cloud.define("getSubscribers", async function(request: any) {
    const id = request.params.id;
  
    
    const query = new Parse.Query("BoardSubscription");
    query.equalTo('board', id);
    // query from boardSubscription table where board is equal to id and also get the user whose ethAddress is the same as the user in the boardSubscription table
    const result = await query.aggregate([
            {
                lookup: {
                    from: '_User',
                    localField: 'user',
                    foreignField: 'ethAddress',
                    as: 'user'
                }
            },
            // need only the createdAt and the user
            {
                project: {
                    createdAt: 1,
                    user: {
                        email: 1,
                        name: 1,
                        ethAddress: 1,
                    }
                }
            },
            // unwind the user array
            {
                unwind: '$user'
            },
            // sort by createdAt
            {
                sort: {
                    createdAt: -1
                }
            }
            
  
        ]);
    
  
    return result;
    
    
  })
  
  Parse.Cloud.define("getCollaborators", async function(request: any) {
    const board = request.params.board;
    const query = new Parse.Query("BoardCollaborators");
    query.equalTo('board', board);
  
    const result = await query.find();
    return result;
  })
  
  Parse.Cloud.define("getAccesibleBoards", async function(request: any) {
    // const account = request.user.get('ethAddress')
    const address = request.params.address;
  
    if(!address) {
        return [];
    }
  
  
    const collaboratorsQuery = new Parse.Query('BoardCollaborators');
    collaboratorsQuery.equalTo("address", address);
  
    // by using aggregate, get the names from the AccountMetadata table where the account is same as the board in the BoardCollaborators table
    const collaborators = await collaboratorsQuery.aggregate([
        {
            lookup: {
                from: 'AccountMetadata',
                localField: 'board',
                foreignField: 'account',
                as: 'accountMetadata'
            }
        },
        {
            project: {
                board: 1,
                // address: 1,
                accountMetadata: {
                    name: 1
                }
            }
        },
        {
            unwind: '$accountMetadata'
        },
        {
            project: {
                board: 1,
                // address: 1,
                name: '$accountMetadata.name'
            }
        }
    ]);
  
    // get name from the AccountMetadata table where account is the same as the address
    const query = new Parse.Query('AccountMetadata');
    query.equalTo('account', address);
    
    const result = await query.find();
    const name = result[0]?.get('name');
  
    const defaultBoard = {
        board: address, 
        ...result[0] ? { name } : { new: true }
    };
  
    return [
        defaultBoard,
        ...collaborators
    ];
    
  })
  
  Parse.Cloud.define("getVotes", async function(request: any) {
    
    const bountyId = request.params.bountyId;
    
    // get all the submissions for this bounty and the number of votes for each submission
    const query = new Parse.Query("BountyMetaFulfilled");
    // logger.info('looking for BountyMetaFullfilled with bountyId ' + bountyId);
    query.equalTo('bountyId', bountyId);
  
    // using lookup, get all the submissions for the given bountyId and the number of votes for each submission in the submissionVotes table where the bountyId is the same and the submissionId is the same
    const result = await query.aggregate([{
            // get count of votes for each submission
            lookup: {
                from: "SubmissionVote",
                localField: "_id",
                foreignField: "submissionId",
                as: "submissionVotes"
            }
        }, {
            project: {
                submissionId: 1,
                voteCount: {
                    $size: "$submissionVotes"
                }
            }
        }
    ]);
    
    // return Object.keys(result);
    // convert result to an object with submissionId as key and voteCount as value
    const votes = {} as any;
    result?.forEach( (item : any) => {
        votes[item.objectId] = item.voteCount;
    });
  
    return {
        votes
    };
    
  })
  
  Parse.Cloud.afterSave("BountyDrained", async (request: any) => {
    const query = new Parse.Query("Bounty");
    query.equalTo('bountyId', request.object.get('bountyId'));
    const queryResults = await query.find();
    if(queryResults?.[0]) {
        const Bounty = queryResults[0];
        Bounty.set("drainTxId", request.object.get('transaction_hash'));
        await Bounty.save(null,{ useMasterKey: true });
    }
  });
  
  Parse.Cloud.afterSave("ContributionAdded", async (request: any) => {
    const contributionId = request.object.get('contributionId');
    // if contributionId is 0, that means, its a contribution made while issuing a new bounty, we do not need to add it to the tokenAmount
    if( contributionId == 0 ) {
        return;
    }
  
    const bountyId = request.object.get('bountyId');
    const amount = new Parse.Cloud.BigNumber(request.object.get('amount'));
    
    const query = new Parse.Query("Bounty");
  
    query.equalTo('bountyId', bountyId)
    
    const queryResults = await query.find()
    
    const bounty = queryResults?.[0];
  
    if(!bounty) {
        throw new Error("Bounty not found");
    }
  
    // check if this contribution has already been added
    const latestContribution = bounty.get('latestContribution');
    // less than or equal because we want to ensure that any older contribution is not re-added, when its status changes
    if( latestContribution !== undefined && contributionId <= latestContribution) {
        return;
    }
  
    const oldAmount = bounty.get('tokenAmount');
    
    let decimals = bounty.get('tokenDecimals');
    
    // fallback, if tokenDecimals is not set, i.e., old data
    if(!decimals) {
        const tokenSymbol = bounty.get('tokenSymbol');
        decimals = tokenSymbol == 'USDC' ? 6 : 18;
    }
  
    const newAmount = new Parse.Cloud.BigNumber( oldAmount * 10**decimals ).plus(amount).dividedBy(10**decimals); 
    
    bounty.set('tokenAmount', newAmount.toNumber());
    bounty.set('latestContribution', contributionId);
  
    await bounty.save(null, { useMasterKey: true });
    
  });
  
  Parse.Cloud.beforeDelete("BoardCollaborators", async (request: any) => {
    const account = request.user.get('ethAddress');
    const boardAddress = request.object.get("board");
  
    if(boardAddress.toLowerCase() !== account.toLowerCase()) {
        // logger.info('Not the Owner of the Board');
        throw new Error('Not the Owner of the Board');
    }
  })
  
  
  Parse.Cloud.beforeSave("BoardCollaborators", async (request: any) => {
    const account = request.user.get('ethAddress');
    const boardAddress = request.object.get("board");
    
  
    if(boardAddress.toLowerCase() !== account.toLowerCase()) {
        // logger.info('Not the Owner of the Board');
        throw new Error('Not the Owner of the Board');    
    }
    const address = request.object.get('address');
    // check in table BoardCollaborators if a record with the same boardAddress and address exists
    const query = new Parse.Query("BoardCollaborators");
    query.equalTo('board', boardAddress);
    query.equalTo('address', address);
    const queryResults = await query.find();
    if(queryResults?.[0]) {
        // logger.info('Collaborator already exists');
        throw new Error('Collaborator already exists');    
    }
  })
  
  Parse.Cloud.beforeSave("AccountMetadata", async (request: any) => {
    
    const account = request.user.get('ethAddress');
    
    const objectId = request.object.id;
    
    if( objectId ) {
        const query = new Parse.Query("AccountMetadata");
        query.equalTo('objectId', objectId)
        
        const queryResults = await query.find()
        
        // this condition is for backwards compatibility for old accountmetadata, that do not have 'owners' column 
        if(queryResults?.[0] && queryResults[0].get('account')?.toLowerCase() !== account.toLowerCase()) {
  
            // this checks if the user is among the assigned owners of the AccountMetadata
            const owners = queryResults[0].get('owners');
            if(!owners?.[0] || undefined === owners.find( (owner : string) => owner.toLowerCase() === account.toLowerCase())) {
                // logger.info('Not the same account');
                throw new Error('Not the same account');    
            }
  
        }
    }
  });
  
  Parse.Cloud.beforeSave("BountyMetaFulfilled", async (request: any) => {
    // implement public read, but no write access. This is to prevent data from being modified even by the submitter
    const acl = new Parse.ACL();
    acl.setPublicReadAccess(true);
  
    request.object.setACL(acl);
  
    const bountyId = request.object.get('bountyId');
    
    if( bountyId ) {
  
        const query = new Parse.Query("Bounty");
        
        query.equalTo('bountyId', bountyId)
        
        const queryResults = await query.find()
        
        const bounty = queryResults?.[0];
  
        if(!bounty) {
            throw new Error("Bounty not found");
        }
  
        let email = bounty.get('email');
        
  
        if( ! email ) {
            // check if the board has an email specified
            const creator = bounty.get('creatorAddress');
            const query = new Parse.Query("AccountMetadata");
            query.equalTo('account', creator)
  
            const queryResults = await query.find()
  
            const accountMetadata = queryResults?.[0];
  
            if( accountMetadata ) {
                email = accountMetadata.get('email');
            }
        }
  
        if( email ) {
            const config = await Parse.Config.get();
            const url = config.get("public_url");
            Parse.Cloud.sendEmail({
                // from: 'notifications@aikido.work',
                to: email,
                templateId: "d-8aa3ea02bbdd49d0aab6308b1d8f1115",
                dynamic_template_data: {
                    link: url+'bounty/'+bounty.id,
                    title: bounty.get('name'),
                }
            });
        }
    }
    
  });
  
  Parse.Cloud.beforeSave("BoardSubscription", async (request: any) => {
    // if record with the same user and board already exists, do not create a new one
    const user = request.user.get('ethAddress');
    const query = new Parse.Query("BoardSubscription");
    
    query.equalTo('user', user);
    query.equalTo('board', request.object.get('board'));
    
    const queryResults = await query.find();
    
    if(queryResults?.[0]) {
        throw new Error('Already subscribed');
    }
  
    request.object.set('user', user);
    
  });
  
  Parse.Cloud.afterSave("BoardSubscription", async (request: any) => {
  
    const board = request.object.get('board');
    const email = request.user.get("email");
    
    if( email ) {
        const config = await Parse.Config.get();
        const url = config.get("public_url");
  
        const query = new Parse.Query("AccountMetadata");
        query.equalTo('objectId', board)
  
        const queryResults = await query.find()
  
        const accountMetadata = queryResults?.[0];
  
  
        if( accountMetadata ) {
            Parse.Cloud.sendEmail({
                // from: 'notifications@aikido.work',
                to: email,
                templateId: "d-57a370e84cb84711a3aa2e0462c9aade",
                dynamic_template_data: {
                    link: url+'board/'+accountMetadata?.get('account'),
                    title: accountMetadata?.get('name'),
                }
            });
        }
    }
  });