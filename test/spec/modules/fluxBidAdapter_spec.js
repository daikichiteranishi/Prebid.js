import { expect } from 'chai';
import { spec } from 'modules/fluxBidAdapter.js';

describe('fluxBidAdapter', function () {
  const PLACEMENT_ID = 1234567;
  const BANNER_ENDPOINT = 'https://prebid-bidder.flux-adserver.com/api/v1/prebid/banner';
  const NATIVE_ENDPOINT = 'https://prebid-bidder.flux-adserver.com/api/v1/prebid/native';
  const DEFAULT_BID = {
    bidder: spec.code,
    params: {
      placementId: PLACEMENT_ID
    },
    adUnitCode: 'adunit-code',
    sizes: [
      [300, 250]
    ],
    bidId: 'bidId12345',
    bidderRequestId: 'bidderRequestId12345',
    auctionId: 'auctionId12345'
  };
  const DEFAULT_NATIVE_BID = {
    ...DEFAULT_BID,
    nativeParams: {
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
  };

  describe('isBidRequestValid', function () {
    it('should return true when params.placementId exists and params.currency does not exist', function () {
      expect(spec.isBidRequestValid(DEFAULT_BID)).to.be.true;
    });

    it('should return true when params.placementId and params.currency exist and params.currency is JPY or USD', function () {
      expect(spec.isBidRequestValid({ ...DEFAULT_BID, params: { ...DEFAULT_BID.params, currency: 'JPY' } })).to.be.true;
      expect(spec.isBidRequestValid({ ...DEFAULT_BID, params: { ...DEFAULT_BID.params, currency: 'USD' } })).to.be.true;
    });

    it('should return false when params.placementId does not exist', function () {
      expect(spec.isBidRequestValid({ ...DEFAULT_BID, params: {} })).to.be.false;
    });

    it('should return false when params.placementId and params.currency exist and params.currency is neither JPY nor USD', function () {
      expect(spec.isBidRequestValid({ ...DEFAULT_BID, params: { ...DEFAULT_BID.params, currency: 'EUR' } })).to.be.false;
    });
  });

  describe('buildRequests', function () {
    it('should replaces currency with JPY if there is no currency provided', function () {
      const request = spec.buildRequests([DEFAULT_BID]);
      expect(request[0].data).to.have.string('&cur=JPY&');
    });

    it('should makes currency the value of params.currency when params.currency exists', function () {
      const request = spec.buildRequests([
        { ...DEFAULT_BID, params: { ...DEFAULT_BID.params, currency: 'JPY' } },
        { ...DEFAULT_BID, params: { ...DEFAULT_BID.params, currency: 'USD' } }
      ]);
      expect(request[0].data).to.have.string('&cur=JPY&');
      expect(request[1].data).to.have.string('&cur=USD&');
    });

    it('should changes the endpoint with banner ads or naive ads', function () {
      const request = spec.buildRequests([DEFAULT_BID, DEFAULT_NATIVE_BID]);
      expect(request[0].url).to.equal(BANNER_ENDPOINT);
      expect(request[1].url).to.equal(NATIVE_ENDPOINT);
    });

    it('should adds a query for naive ads and no query for banner ads', function () {
      const query = 'tkf=1&ad_track=1&apiv=1.1.0';
      const request = spec.buildRequests([DEFAULT_BID, DEFAULT_NATIVE_BID]);
      expect(request[0].data).to.not.have.string(query);
      expect(request[1].data).to.have.string(query);
    });

    it('should makes the values of loc query and referer query a blank string when bidderRequest.refererInfo.referer is a falsy value', function () {
      const request = spec.buildRequests([DEFAULT_BID]);
      expect(request[0].data).to.have.string('&loc=&');
      expect(request[0].data.slice(-9)).to.equal('&referer=');
    });

    it('should sets the values for loc and referer queries when bidderRequest.refererInfo.referer has a value', function () {
      const referer = 'https://example.com/';
      const request = spec.buildRequests([DEFAULT_BID], { refererInfo: { referer: referer } });
      expect(request[0].data).to.have.string(`&loc=${encodeURIComponent(referer)}&`);
      expect(request[0].data).to.have.string(`&referer=${encodeURIComponent(referer)}`);
    });

    it('should sets the value of the adtk query to 1 when window.geparams.lat does not exist', function () {
      const request = spec.buildRequests([DEFAULT_BID]);
      expect(request[0].data).to.have.string('&adtk=1&');
    });

    it('should sets the value of the adtk query to 0 when window.geparams.lat exists', function () {
      Object.defineProperty(window, 'geparams', {
        value: { lat: 'hoge' },
        writable: true
      });
      const request = spec.buildRequests([DEFAULT_BID]);
      expect(request[0].data).to.have.string('&adtk=0&');
    });
  });

  describe('interpretResponse', function () {
    const response = {};
    response[PLACEMENT_ID] = {
      'creativeId': '<!-- CREATIVE ID -->',
      'cur': 'JPY',
      'price': 0.0920,
      'width': 300,
      'height': 250,
      'requestid': '2e42361a6172bf',
      'adm': '<!-- ADS TAG -->'
    };
    const nativeResponse = {};
    nativeResponse[PLACEMENT_ID] = {
      ...response[PLACEMENT_ID],
      'title': 'aaa',
      'description': 'iii',
      'cta': 'uuu',
      'advertiser': 'eee',
      'landingURL': 'https://example.com/',
      'trackings': 'ooo'
    };
    const expected = {
      'requestId': response[PLACEMENT_ID].requestid,
      'cpm': response[PLACEMENT_ID].price,
      'creativeId': response[PLACEMENT_ID].creativeId,
      'netRevenue': true,
      'currency': 'JPY',
      'ttl': 700
    };
    const expectedNative = {
      ...expected,
      mediaType: 'native',
      native: {
        'title': nativeResponse[PLACEMENT_ID].title,
        'body': nativeResponse[PLACEMENT_ID].description,
        'cta': nativeResponse[PLACEMENT_ID].cta,
        'sponsoredBy': nativeResponse[PLACEMENT_ID].advertiser,
        'clickUrl': encodeURIComponent(nativeResponse[PLACEMENT_ID].landingURL),
        'impressionTrackers': nativeResponse[PLACEMENT_ID].trackings
      }
    };

    it('should sets the response correctly when it comes to banner ads', function () {
      const expectedBanner = {
        ...expected,
        'width': response[PLACEMENT_ID].width,
        'height': response[PLACEMENT_ID].height,
        'ad': response[PLACEMENT_ID].adm
      };
      const request = spec.buildRequests([DEFAULT_BID])[0];
      const result = spec.interpretResponse({ body: response }, request);
      expect(result[0]).to.have.deep.equal(expectedBanner);
    });

    it('should sets the response correctly when it is a native ad', function () {
      const request = spec.buildRequests([DEFAULT_NATIVE_BID])[0];
      const result = spec.interpretResponse({ body: nativeResponse }, request);
      expect(result[0]).to.have.deep.equal(expectedNative);
    });

    it('should sets native.image when there are screenshots in the response in the native ad', function () {
      const screenshots = {
        url: 'https://example.com/',
        width: 300,
        height: 250,
      };
      const nativeImageResponse = { ...nativeResponse };
      nativeImageResponse[PLACEMENT_ID].screenshots = screenshots;
      const expectedNativeImage = { ...expectedNative, };
      expectedNativeImage.native.image = screenshots;
      const request = spec.buildRequests([DEFAULT_NATIVE_BID])[0];
      const result = spec.interpretResponse({ body: nativeImageResponse }, request);
      expect(result[0]).to.have.deep.equal(expectedNativeImage);
    });

    it('should sets native.icon when there is an icon in the response in the native ad', function () {
      const icon = {
        url: 'https://example.com/',
        width: 300,
        height: 250,
      };
      const nativeIconResponse = { ...nativeResponse };
      nativeIconResponse[PLACEMENT_ID].icon = icon;
      const expectedNativeIcon = { ...expectedNative, };
      expectedNativeIcon.native.icon = icon;
      const request = spec.buildRequests([DEFAULT_NATIVE_BID])[0];
      const result = spec.interpretResponse({ body: nativeIconResponse }, request);
      expect(result[0]).to.have.deep.equal(expectedNativeIcon);
    });
  });
});
