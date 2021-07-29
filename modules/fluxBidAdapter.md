# Overview

```
Module Name: Flux Bidder Adapter
Module Type: Bidder Adapter
Maintainer: sales@flux-g.com
```

# Description

Flux adapter for Prebid.js
Flux bid adapter supports Banner, Native.

# Test Parameters
```js
var adUnits = [
  {
    code: 'banner-slot',
    sizes: [[300, 250]],
    mediaTypes: {
      banner: {
        sizes: [[300, 250]],
      }
    },
    bids: [
      {
        bidder: 'AdCurrent',
        params: {
          placementId: 1234567, // required, integer
          currency: 'JPY' // optional, JPY or USD is valid
        }
      }
    ]
  },{
    code: 'native-slot',
    mediaTypes: {
      native: {
        title: {
          required: true,
          len: 80
        },
        image: {
          required: true,
          sizes: [150, 50]
        },
        sponsoredBy: {
          required: true
        }
      }
    },
    bids: [
      {
        bidder: 'AdCurrent',
        params: {
          placementId: 1234567, // required, integer
          currency: 'JPY' // optional, JPY or USD is valid
        }
      }
    ]
  }
];
```
