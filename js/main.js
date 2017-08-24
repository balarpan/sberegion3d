/* #####################################################################################
#(c) Copyright 2017 by Denis Savitskiy
#for commercial and non-commercial use please contact me at balarpan_at_gmail.com
#####################################################################################
This code based on jQuery and jQuery UI plugins ( http://jquery.com and http://jqueryui.com )
*/

/** 
 * @version 0.1
 * @author Denis Savitskiy balarpan@gmail.com
 * @external QryBuilder
 */



'use strict'

require([
  "esri/Map",
  "esri/views/SceneView",
  "esri/layers/FeatureLayer",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/ObjectSymbol3DLayer",
  "esri/symbols/IconSymbol3DLayer",
  "esri/symbols/PolygonSymbol3D",
  "esri/symbols/ExtrudeSymbol3DLayer",
  "esri/widgets/Legend",
  "esri/tasks/QueryTask",
  "esri/tasks/support/Query",
  "esri/widgets/Home",
  "esri/symbols/TextSymbol3DLayer",
  "esri/symbols/LabelSymbol3D",
  "esri/layers/support/LabelClass", "esri/Color",
  "esri/core/watchUtils",
  "dojo/domReady!"
], function(Map, SceneView, FeatureLayer,
  SimpleRenderer, ObjectSymbol3DLayer,
  IconSymbol3DLayer, PolygonSymbol3D, ExtrudeSymbol3DLayer, Legend, QueryTask, Query, Home,
  TextSymbol3DLayer, LabelSymbol3D, LabelClass, Color,
  watchUtils
) {

  globalCache.readyPromise().then( function(){

    // The clipping extent for the scene
    var russiaExtent = { // autocasts as new Extent()
      xmax: 20037507,
      xmin: 2226522,
      ymax: 16854341,
      ymin: 5216059,
      spatialReference: { // autocasts as new SpatialReference()
        wkid: 3857
      }
    };

    var regionPopupTemplate = { // autocasts as new PopupTemplate()
      title: "<font color='#008000'>Показатели региона.</font>",
      content: "<b>Название региона:</b> {NameSub}<br>" +
        "<b>Параметр1:</b> {DEPTH} meters<br>",
      fieldInfos: [{
        fieldName: "SPUD",
        format: {
          dateFormat: "short-date"
        }
      }, {
        fieldName: "COMPLETION",
        format: {
          dateFormat: "short-date"
        }
      }, {
        fieldName: "DEPTH",
        format: {
          places: 0,
          digitSeparator: true
        }
      }]
    };

    var regionsRenderer = new SimpleRenderer({
      symbol: new PolygonSymbol3D({
        symbolLayers: [new ExtrudeSymbol3DLayer()] // creates volumetric symbols for polygons that can be extruded
      }),
      label: "суммарный потенциал",
      visualVariables: [{
        type: "size", // indicates this is a size visual variable
        field: regionExtrudeAmount, // a special function will return the height of shape.
      }, {
        type: "color",
        field: regionColor,
        // normalizationField: "Shape__Length",
        stops: [{
          value: 20,
          color: [217,255,214]
        }, {
          value: 40,
          color: [125,248,124]
        }, {
          value: 60,
          color: [24, 196, 24]
        }, {
          value: 80,
          color: [12, 120, 11]
        }]
      }]
    });

    
    var regionsRFLyr = new FeatureLayer({
      url: config.regionRF,
      // definitionExpression: "Status = 'CBM' OR Status = 'EOR' OR Status = 'GAS' OR Status = 'INJ' OR Status = 'O&G' OR Status = 'OIL' OR Status = 'SWD'",
      outFields: ["*"],
      popupTemplate: regionPopupTemplate,
      // This keeps the cylinders from poking above the ground
      elevationInfo: {
        mode: "relative-to-ground",
        offset: 10000
      },
      opacity: 1.0,
      renderer: regionsRenderer
    });

    var regionsLabelClass = new LabelClass({
      labelExpressionInfo: {
        value: "{NameSub}" // Text for labels comes from this field
      },
      symbol: new LabelSymbol3D({
        symbolLayers: [new TextSymbol3DLayer({
          material: {
            color: "#000000"
          },
          size: 10 // points
        })]
      })
    });
    regionsRFLyr.labelsVisible = true;
    regionsRFLyr.labelingInfo = [regionsLabelClass];


    /********************************************************
     * The popupTemplate that will populate the content of the
     * popup when an earthquake feature is selected
     *******************************************************/

    var quakeTemplate = { // autocasts as new PopupTemplate()
      title: "{place}",
      content: "<b>Date and time:</b> {date_evt}<br>" +
        "<b>Magnitude (0-10): </b> {mag}<br>" +
        "<b>Depth: </b> {depth} km<br>",
      fieldInfos: [{
        fieldName: "date_evt",
        format: {
          dateFormat: "short-date-short-time"
        }
      }],
      actions: [{
        id: "find-wells",
        title: "Nearby wells"
      }]
    };

    /********************************************************
     * Create earthquakes layers (one on the surface and one
     * below the surface to show actual location).
     *******************************************************/

    var map = new Map({
      basemap: "gray",
      layers: [regionsRFLyr]
    });

    var view = new SceneView({
      container: "viewDiv",
      map: map,
      // Indicates to create a local scene
      viewingMode: "local",
      // Use the exent defined in clippingArea to define the bounds of the scene
      clippingArea: russiaExtent,
      extent: russiaExtent,
      // Disallow for navigating the camera below the surface
      constraints: {
        collision: {
          enabled: true
        },
        tilt: {
          max: 79.99
        }
      },
      // Turns off atmosphere and stars settings
      environment: {
        atmosphere: null,
        starsEnabled: false,
        directShadowsEnabled: true,
        ambientOcclusionEnabled: true
      },
      popup: {
        dockEnabled: false,
        dockOptions: { buttonEnabled: true, breakpoint: false}
      }
    });

    watchUtils.watch(view, "updating", function(){
      $("#mapLoadingProgress").stop();
      if (view.updating) 
        $("#mapLoadingProgress").show(800);
      else
        $("#mapLoadingProgress").hide();
    })

    var legend = new Legend({
      view: view
    });
    view.ui.add(legend, "bottom-right");

    // Defines an action to zoom out from the selected feature
    var flatMapAction = {
      title: "Показать в 2D",
      id: "viewAt2DMap",
      className: "esri-icon-maps"
    }
    view.popup.actions.push(flatMapAction);

    view.popup.on("trigger-action", function(event) {
      if (event.action.id === "viewAt2DMap") {
        var regionID = view.popup.selectedFeature.attributes.FID;

        document.location.href = window.location.href.substring(0, location.href.lastIndexOf("/")+1) + '/flatmap.html?' + $.param({regionID: regionID, regionName:view.popup.selectedFeature.attributes.NameSub});

      } else {
        return;
      }
    });

    // Set up a home button for resetting the viewpoint to the intial extent
    var homeBtn = new Home({
      view: view
    }, "homeDiv");

  })//end of globalCahce ready Promise
});


//This is a helper functions.
//

/*
This functions is used to compute amount of extrusion of each subregion.
@param {Esri.Graphics} feat   - An individual feature presents ass Grahics object.
@return {integer}             - A heigth in meters.
 */
function regionExtrudeAmount(feat){
  var inSize=feat.attributes.Shape__Area
  var outSize = 100 * inSize / globalCache._paramsStat[0].max
  return parseInt(outSize*5000) //100% = max value = 5 000 menters
}

/*
This functions is used to compute color of each subregion.
@param {Esri.Graphics} feat   - An individual feature presents ass Grahics object.
@return {Array[]}             - Array of color values as described in JS API SDK.
 */
function regionColor(feat){
  var inSize=feat.attributes.Shape__Area
  var outSize = 100 * inSize / globalCache._paramsStat[0].max

  return parseInt(outSize)
}

/*
 Class for store parameters (minmax values, etc) to reduce query stream into the server.
 @class
*/
var GlobalCacheObj = function(options) {
  this._deferArray = {};
  this._paramsStat = { paramsMinMax:[] };
  this.init();
}
GlobalCacheObj.prototype = {
  constructor: GlobalCacheObj,
  init: function() {
    this._deferArray = {};

    this.purgeRegionsStatistics();
    this.getRegionsStatistics();
  },
  /*
  Returns deferred which will be resolved when all internal process has been done.

  @return [Promise]
   */
  readyPromise: function(){
    // if (this._deferArray.length > 10 ){
    //   this._deferArray = this._deferArray.filter( function(v){ return v.isResolved();})
    // }
    var scope = this;
    return $.when( Object.keys(scope._deferArray).map( function(item){ return scope._deferArray[item]}) )
  },
  /*
  Query server for regions parameters statistic. At example min and max values of each params groups.

  @return [Promise]
   */
  getRegionsStatistics: function() {
    var params = {
      where: "1=1",
      outStatistics: '[{statisticType: "min", onStatisticField: "Shape__Area", outStatisticFieldName: "Out_Field_Name1"},' +
        '{statisticType: "max", onStatisticField: "Shape__Area", outStatisticFieldName: "Out_Field_Name2"}]'
    };
    var defer = jQuery.Deferred();
    this._deferArray.regionsStat =  defer;
    
    QryBuilder.qryJSON(config.regionRF + '/query', params).always(
      function(r) {
        if (r.features !== undefined) {
          this._paramsStat = [{
            min: r.features[0].attributes.Out_Field_Name1,
            max: r.features[0].attributes.Out_Field_Name2
          }]

          defer.resolve(this._paramsStat)
        } else {
          defer.reject(r)
        }
      }.bind(this) )
    return defer.promise();
  },
  purgeRegionsStatistics: function(){ this._paramsStat = null }
}
var globalCache = new GlobalCacheObj()
