import * as utils from '../src/utils.js';
import { registerBidder } from '../src/adapters/bidderFactory.js';
import { BANNER, NATIVE } from '../src/mediaTypes.js';

const BIDDER_CODE = 'AdCurrent';
const BANNER_ENDPOINT = 'https://prebid-bidder.flux-adserver.com/api/v1/prebid/banner';
const NATIVE_ENDPOINT = 'https://prebid-bidder.flux-adserver.com/api/v1/prebid/native';
const COOKIE_SYNC_URL = 'https://prebid-bidder.flux-adserver.com/api/v1/cookie/gen';
const SUPPORTED_MEDIA_TYPES = [BANNER, NATIVE];
const DEFAULT_CURRENCY = 'JPY';
const ALLOWED_CURRENCIES = ['USD', 'JPY'];
const NET_REVENUE = true;

/**
 * @param {string} str
 * @returns
 */
function _encodeURIComponent(str) {
  return window.encodeURIComponent(str).replace(/'/g, '%27');
}

/**
 * @param {string} url
 * @returns
 */
function _getUrlVars(url) {
  const myJson = {};
  const hashes = url.slice(url.indexOf('?') + 1).split('&');
  for (let i = 0; i < hashes.length; i++) {
    let hash = hashes[i].split('=');
    myJson[hash[0]] = hash[1];
  }
  return myJson;
}

export const spec = {
  code: BIDDER_CODE,
  supportedMediaTypes: SUPPORTED_MEDIA_TYPES,
  /**
   * Determines whether or not the given bid request is valid.
   *
   * @param {BidRequest} bidRequest The bid request params to validate.
   * @return boolean True if this is a valid bid request, and false otherwise.
   */
  isBidRequestValid: function (bidRequest) {
    if (!bidRequest.params.placementId) return false;
    if (bidRequest.params.hasOwnProperty('currency')) {
      if (ALLOWED_CURRENCIES.indexOf(bidRequest.params.currency) === -1) {
        utils.logError('Invalid currency type, we support only JPY and USD!');
        return false;
      }
    }
    return true;
  },
  /**
   * Make a server request from the list of BidRequests.
   *
   * @param {Array<BidRequest>} validBidRequests an array of bid requests
   * @return ServerRequest Info describing the request to the server.
   */
  buildRequests: function (validBidRequests, bidderRequest) {
    const serverRequests = [];
    let referer = '';
    if (bidderRequest && bidderRequest.refererInfo && bidderRequest.refererInfo.referer) {
      referer = bidderRequest.refererInfo.referer;
    }

    const g = typeof window.geparams === 'object' ? window.geparams : {};
    validBidRequests.forEach((bid) => {
      let endpoint = BANNER_ENDPOINT;
      let data = {
        'placementid': bid.params.placementId,
        'cur': bid.params.hasOwnProperty('currency') ? bid.params.currency : DEFAULT_CURRENCY,
        'ua': navigator.userAgent,
        'adtk': g.lat ? '0' : '1',
        'loc': referer,
        'topframe': (window.parent == window.self) ? 1 : 0,
        'sw': screen && screen.width,
        'sh': screen && screen.height,
        'cb': Math.floor(Math.random() * 99999999999),
        'tpaf': 1,
        'cks': 1,
        'requestid': bid.bidId,
        'referer': referer
      };

      if (bid.hasOwnProperty('nativeParams')) {
        endpoint = NATIVE_ENDPOINT;
        data.tkf = 1; // return url tracker
        data.ad_track = '1';
        data.apiv = '1.1.0';
      }

      serverRequests.push({
        method: 'GET',
        url: endpoint,
        data: utils.parseQueryStringParameters(data)
      });
    });

    return serverRequests;
  },
  /**
   * Unpack the response from the server into a list of bids.
   *
   * @param {ServerResponse} serverResponse A successful response from the server.
   * @param {BidRequest} bidderRequest A matched bid request for this response.
   * @return Array<BidResponse> An array of bids which were nested inside the server.
   */
  interpretResponse: function (serverResponse, request) {
    const data = _getUrlVars(request.data)
    const successBid = serverResponse.body || {};
    let bidResponses = [];
    if (successBid.hasOwnProperty(data.placementid)) {
      let bid = successBid[data.placementid]
      let bidResponse = {
        requestId: bid.requestid,
        cpm: bid.price,
        creativeId: bid.creativeId,
        currency: bid.cur,
        netRevenue: NET_REVENUE,
        ttl: 700
      };

      if (bid.hasOwnProperty('title')) { // it is native ad response
        bidResponse.mediaType = NATIVE;
        bidResponse.native = {
          title: bid.title,
          body: bid.description,
          cta: bid.cta,
          sponsoredBy: bid.advertiser,
          clickUrl: _encodeURIComponent(bid.landingURL),
          impressionTrackers: bid.trackings,
        }
        if (bid.screenshots) {
          bidResponse.native.image = {
            url: bid.screenshots.url,
            height: bid.screenshots.height,
            width: bid.screenshots.width,
          }
        }
        if (bid.icon) {
          bidResponse.native.icon = {
            url: bid.icon.url,
            height: bid.icon.height,
            width: bid.icon.width,
          }
        }
      } else {
        bidResponse.ad = bid.adm
        bidResponse.width = bid.width
        bidResponse.height = bid.height
      }

      bidResponses.push(bidResponse);
    }

    return bidResponses;
  },
  getUserSyncs: function (syncOptions, serverResponses) {
    let syncs = []
    syncs.push({
      type: 'image',
      url: COOKIE_SYNC_URL
    })

    return syncs;
  },
  onTimeout: function (timeoutData) { },
  onBidWon: function (bid) { },
  onSetTargeting: function (bid) { }
}

registerBidder(spec);
