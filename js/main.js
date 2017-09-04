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
  "esri/widgets/Home", "esri/widgets/Expand", "esri/widgets/BasemapGallery", 
  "esri/symbols/TextSymbol3DLayer",
  "esri/symbols/LabelSymbol3D",
  "esri/layers/support/LabelClass", "esri/Color",
  "esri/core/watchUtils", "esri/views/3d/externalRenderers",
  "dojo/domReady!"
], function(Map, SceneView, FeatureLayer,
  SimpleRenderer, ObjectSymbol3DLayer,
  IconSymbol3DLayer, PolygonSymbol3D, ExtrudeSymbol3DLayer, Legend,
  Home, Expand, BasemapGallery,
  TextSymbol3DLayer, LabelSymbol3D, LabelClass, Color,
  watchUtils, externalRenderers,
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
      content: function(target){
        var att = target.graphic.attributes;
        var defer = jQuery.Deferred();

        var ret =  ['<b style="color:#008000; font-size:14px;">', GUI.htmlEscape(att.RegionName), "</b>&nbsp;&nbsp;Код Региона:<b> ", GUI.htmlEscape(att.RegionCode), "</b><br>"]
        var values = globalCache.getStatforRegion( att.RegionCode )
        if ( values ) {
          ret.push('<div class="popupTabs"> <button class="popupTablinks active" onclick="$(\'#popupTab1\').show(); $(\'#popupTab2\').hide(); $(this).siblings().removeClass(\'active\'); $(this).addClass(\'active\');">Диаграмма показателей</button>\
            <button class="popupTablinks" onclick="$(\'#popupTab1\').hide().removeClass(\'active\'); $(\'#popupTab2\').show(); $(this).siblings().removeClass(\'active\'); $(this).addClass(\'active\');">Таблица показателей</button></div>')

          $('#popupPieCont').remove();
          ret.push('<div id="popupTab1" class="popupTabcontent" style="display:block;"><canvas id="popupPieCont" width="300" height="150"></canvas></div>');

          ret.push("<div id='popupTab2' class='popupTabcontent'><b>Суммарное значение показателей:</b> " + values.val + "<br><br>Значения всех показателей:<br>");
          ret.push( GlobalCacheObj.statParamNames.map( function(el, ind){ return "<b>"+GUI.htmlEscape(el.viewName)+"</b>: "+GUI.htmlEscape(globalCache._regionStat[att.RegionCode][ind])+ "<br>"}).join('') )
          ret.push("</div>")
        }
        else
          ret.push( "<i>Для данного региона показатели не предоставлены.</i>")

        ret = $('<div/>').html( ret.join('') )
        if( values ){
          try {
            regionPieChart( att.RegionCode,  ret.find('canvas').get(0).getContext("2d") )
          }
          catch(err){
            console.debug(err)
          }
        }

        // defer.resolve( ret )
        // return defer;
        return ret.get(0);
      },
      // content: "<b>Название региона:</b> {RegionName}<br>" +
      //   "<b>Код Региона:</b> {RegionCode}<br>",
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
        fieldName: "RegionCode",
        format: {
          places: 0,
          digitSeparator: false
        }
      }]
    };

    var regionsRenderer = new SimpleRenderer({
      symbol: new PolygonSymbol3D({
        symbolLayers: [new ExtrudeSymbol3DLayer()] // creates volumetric symbols for polygons that can be extruded
      }),
      label: "потенциал",
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
        value: "{RegionName}" // Text for labels comes from this field
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


    var map = new Map({
      basemap: "gray",
      layers: [regionsRFLyr]
    });

    var viewParams = {
      container: "viewDiv",
      map: map,
      // Indicates to create a local scene
      viewingMode: config.globeView ? "global" : "local",
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
    };
    if ( !config.globeView )
      viewParams.camera= {
        position:[
        92.5, //lon
        -62.5, //latitude
        12188173 //elevation
        ],
        heading:1.96,
        tilt:57
      }

    var view = new SceneView(viewParams);

    // var myExternalRenderer = {
    //   vbo: null,
    //   setup: function(context) {
    //     var a = 1; //alpha
    //     context.gl.clearColor(1 * a, 1*a, 1*a, a);
    //   },
    //   render: function(context) {
    //     // bind a shader program etc.
    //     var a = 1; //alpha
    //     context.gl.clearColor(0.5 * a, 0.5*a, 0.5*a, a);
    //     context.gl.clear(context.gl.COLOR_BUFFER_BIT)
    //   }
    // }
    // externalRenderers.add(view, myExternalRenderer);

    watchUtils.watch(view, "updating", function(){
      $("#mapLoadingProgress").stop();
      if (view.updating) 
        $("#mapLoadingProgress").show(800);
      else
        $("#mapLoadingProgress").hide();
    })

    var legend = new Legend({
      view: view,
      layerInfos: [{
      	layer: regionsRFLyr,
      	title: "Субъекты РФ"
      }]
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
        config.callParams.regionCode = view.popup.selectedFeature.attributes.RegionCode;
        document.location.href = window.location.href.substring(0, location.href.lastIndexOf("/")+1) + './flatmap.html?' + $.param(config.callParams);
      } else {
        return;
      }
    });

    // Set up a home button for resetting the viewpoint to the intial extent
    var homeBtn = new Home({
      view: view
    }, "homeDiv");

    view.ui.add('globeView', 'top-left');
    watchUtils.watch(view, "ready", function(){
      $('#globeView').click(function(e){ e.stopPropagation(); config.callParams.globeView = !config.globeView; window.location.href='./index.html?' + $.param(config.callParams)})
    });
    //basemam toggle with expand widget
    var basemapGallery = new BasemapGallery({
      view: view,
      container: document.createElement("div")
    });
    var bgExpand = new Expand({
      view: view,
      content: basemapGallery.domNode,
      expandIconClass: "esri-icon-basemap",
      expandTooltip: "Базовая карта", autoCollapse:true
    });
    view.ui.add(bgExpand, "top-left");

    //Now check if we have selected region in url params. Do it after all other downloading processes are done.
    if ("regionCode" in config.callParams && Number.isInteger(parseInt(config.callParams.regionCode,10)) ){
    	view.whenLayerView(regionsRFLyr).then(function(lyrView) {
    		lyrView.watch("updating", function(val) {
    			if (val) {
    				return; // wait for the layer view to finish updating
    			}
		    	var qryParams = regionsRFLyr.createQuery();
		    	qryParams.where = qryParams.where + (qryParams.where.length ? " AND " : "") +"RegionCode=" + parseInt(config.callParams.regionCode,10);
		    	regionsRFLyr.queryFeatures(qryParams).then(function(results){
		    		view.popup.open({
		    			features: [results.features[0]],
		    			location: results.features[0].geometry.centroid
		    		});
		    	}).otherwise(function(err){ console.debug(err) });
		    });//end of watch "updating"
	    });//end of whenlayerView
    }

    var paramsSelector = new GUI.Carousel({
      dom_container: 'paramsSelectPane',
      orientation: 'horizontal',
      itemCSS: 'paramSelectPaneItem checked',
      onClick: function(e, userData) {
        // self._floorSQL = userData
        $(e.delegateTarget).toggleClass('checked');
        globalCache.uiParamOn[userData.index] = !globalCache.uiParamOn[userData.index];
        regionsRFLyr.definitionExpression = regionsRFLyr.definitionExpression ? null : "1=1";
      },
    })
    GlobalCacheObj.statParamNames.forEach( function(inParam, index){
      paramsSelector.addItem( $('<div>'+GUI.htmlEscape(inParam.viewName) +'</div>'), {paramName:inParam.sqlName, index:index} );
    })

  })//end of globalCahce ready Promise

});


//Below is a helper functions and JS Objects.

/*
This functions is used to compute amount of extrusion of each subregion.
@param {Esri.Graphics} feat   - An individual feature presents ass Grahics object.
@return {integer}             - A heigth in meters.
 */
function regionExtrudeAmount(feat){
  var v = globalCache.getStatforRegion(feat.attributes.RegionCode);
  if ( !v )
    return 0;
  var inSize = v.val;
  var max = v.max
  var outSize = 100* inSize / max
  return parseInt(outSize*5000) //100% = max value = 5 000 menters
}

/*
This functions is used to compute color of each subregion.
@param {Esri.Graphics} feat   - An individual feature presents ass Grahics object.
@return {Array[]}             - Array of color values as described in JS API SDK.
 */
function regionColor(feat){
  var v = globalCache.getStatforRegion(feat.attributes.RegionCode);
  if ( !v )
    return 0;
  var inSize = v.val;
  var max = v.max
  var outSize = 100 * inSize / max;

  return parseInt(outSize)
}
/**
 * Create a 
 * @param  {Number} regCode   Unique code of the region.
 * @param  {[type]} ctx       Canvas 2D context same as result of function canvas..getContext("2d")
 * @return {[type]}         [description]
 */
function regionPieChart( regCode, ctx ){
  var grd = new GUI.Gradient({
    colorStart:'#4854f8',
    colorEnd: '#aafe99'}
    ), valuesLen = GlobalCacheObj.statParamNames.length;
  var myPieChart = new Chart(ctx,{
    type: 'pie',
    data: {
      datasets: [{
        data:GlobalCacheObj.statParamNames.map( function(el, ind){ return globalCache._regionStat[regCode][ind]; }),
        backgroundColor: Array(valuesLen).fill(undefined).map( function(el,ind){ return grd.getRGBstring(ind/valuesLen)}),
        borderWidth: 1,
        hoverBorderColor: 'rgba(128,128,128,0.3)',
        // hoverBorderColor: 'rgba(0,0,0,0)'
      }],
      labels: GlobalCacheObj.statParamNames.map( function(el, ind){ return GUI.htmlEscape(el.viewName); }),
    },
    options: {
      responsive: true,
      legend: {position: 'right'},
    }
});
}

/*
 Class for store parameters (minmax values, etc) to reduce query stream into the server.
 @class
*/
var GlobalCacheObj = function(options) {
  this._deferArray = {};
  this._regionStat = {};
  this.uiParamOn = Array(GlobalCacheObj.statParamNames.length).fill(true)
  this.init();
}
GlobalCacheObj.prototype = {
  constructor: GlobalCacheObj,
  init: function() {
    this._deferArray = {};
    this.purgeregionisStat();
    this.fetchRegionsStat();
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
  fetchRegionsStat: function() {
    var statQry = [];
    var fldPrefix = 'sts';
    for (var i=0; i<GlobalCacheObj.statParamNames.length; i++){
      statQry.push( {statisticType: "max", onStatisticField: GlobalCacheObj.statParamNames[i].sqlName, outStatisticFieldName: fldPrefix + i.toString()}, )
    }
    var params = {
      where: "1=1",
      groupByFieldsForStatistics: 'RegionCode',
      outStatistics: JSON.stringify(statQry)
    };
    var defer = jQuery.Deferred();
    this._deferArray.regionsStat =  defer;
    var _scope = this;
    
    QryBuilder.qryJSON(config.regionCompanies + '/query', params).always(
      function(r) {
        if (r.features !== undefined) {
          _scope.purgeregionisStat();
          r.features.forEach( function(row){
            var att = row.attributes;
            _scope._regionStat[att.RegionCode] = []
            for( var i =0; i<GlobalCacheObj.statParamNames.length; i++)
              _scope._regionStat[att.RegionCode].push( att[fldPrefix + i.toString()] )
          })
          //compute max values for normalization in 3D view
          var max = null;
          Object.keys(_scope._regionStat).forEach( function(regCode){
            if ( !max ) {
              max = _scope._regionStat[regCode];
              return;
            }
            max = max.map( function( current, index ){
              return current > _scope._regionStat[regCode][index] ? current : _scope._regionStat[regCode][index]
            })
          });
          _scope._regionStat['max'] = max;

          defer.resolve(_scope._regionStat)
        } else {
          defer.reject(r)
        }
      }.bind(this) )
    return defer.promise();
  },
  purgeregionisStat: function(){ this._regionStat = {} },
  getStatforRegion: function(regCode){
    if ( this._regionStat && this._regionStat[regCode] ) {
      var _scope = this;
      var ret = _scope._regionStat[regCode].filter( function(el, ind){ return _scope.uiParamOn[ind] })
      if ( !ret.length )
        return null;
      ret = ret.reduce( function(sum,val){return sum + val});
      var retMax = _scope._regionStat['max'].filter( function(el, ind){ return _scope.uiParamOn[ind] }).reduce( function(sum,val){return sum + val});
      return {val: ret, max: retMax}
    }
    else
      return null
  },
}
/* constants */
GlobalCacheObj.statParamNames = [];
for (var i=1; i<=10; i++) {
  GlobalCacheObj.statParamNames.push( {sqlName: "param" + i.toString(), viewName:"Параметр_" + i.toString() })
}

var globalCache = new GlobalCacheObj()

