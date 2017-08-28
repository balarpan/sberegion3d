'use strict';

/**
 * @module QryBuilder
 * @version 0.1
 *
 * @requires jQuery
 */

/**
Feature geometric representation. Usualy returned inside @see {@link responseJSON}
@typedef featureJSON
  @type {object}
  @property {Object.<string, string>} attributes      - Array of attributes of feature.
  @property {Object} geometry				- A geometry representation of feature
  @property {Number[ Number[] ]} geometry.paths    - In case of polyline geoemtry stored inside paths property
  @property {Number[ Number[] ]} geometry.rings    - In case of polygon geoemtry stored inside paths property
  @property {Number} geometry.x      	- In case of point feature featureJSON.geometry contain x-coord. 
  @property {Number} geometry.y      	- In case of point feature featureJSON.geometry contain y-coord. 

Description of respose from AGS
@typedef responseJSON
  @type {object}
  @property {string} geometryType									- Can be "esriGeometryPolygon","esriGeometryPolyline" or "esriGeometryPoint"
  @property {{wkid:string, latestWkid:string}} spatialReference		-
  @property {{name:string, alias:string, type:string}[]}} fields	- Fields description. Type can by esriFieldTypeOID, esriFieldTypeGlobalID, esriFieldTypeString, esriFieldTypeDate or 
  @property {featureJSON[]} features								- A collection of features.
 */

var QryBuilder = function() {}

//Static variables

QryBuilder._lastAGSquery = new Date().getTime();
//minimal pause between each query to ArcGIS Server or AGOL
QryBuilder.minAGSqryPause = 100;

/**
 * @name QryBuilder#esri2geomType
 * @type { Object.<string, string> }
 * @readonly
 */
 Object.defineProperty( QryBuilder, "esri2geomType", {
 	value: {'esriGeometryPoint':'point', 'esriGeometryPolyline':'line', 'esriGeometryPolygon':'area'},
 	writable: false
 });


//static methods

//Escape string for safe past into SQL-command. Useful for use with field values when construct SQL WHERE clause. 
QryBuilder.escapeSQL = function(str) {
	if (!QryBuilder.escapeSQL.regx)
		QryBuilder.escapeSQL.regx = new RegExp(/[\0\x08\x09\x1a\n\r"'\\]/g);
	return str.replace(QryBuilder.escapeSQL.regx, function(char) {
			var m = ['\\0', '\\x08', '\\x09', '\\x1a', '\\n', '\\r', "'", '"', "\\", '\\\\', ];
			var r = ['\\\\0', '\\\\b', '\\\\t', '\\\\z', '\\\\n', '\\\\r', "''", '""', '\\\\', '\\\\\\\\', ];
			return r[m.indexOf(char)];
		});
}

QryBuilder.isAGSError = function( responce ) {
	if ( responce.hasOwnProperty('error') )
			return true;
		else
			return false;
}

/**
 * query ArcGIS web service and return Deferred object
 * @param  {!string} url	- URL for sending AJAX request
 * @param  {!Object} data 	- An Object to send
 * @param  {!Object} params 	- A jQuery .ajax params to override
 * @return {jQuery.Promise}	- A promise object.
 * @static
 */
QryBuilder.qryJSON = function( url, data, params ) {
	var defer = $.Deferred();
	$.extend( data, {f:"json"} );
	var prms = $.extend({
		async:true, cache:true,
		crossDomain: true,
		dataType:"json", method:"GET",
		data: data
	}, params);
	//if URL too large we change method to POST
	prms.method = (url.length + JSON.stringify( data ).length) > 2000 ? "POST" : prms.method;

	//prevent query ArcGIS Server too frequently (some of queries can be silently drop on ArcGIS OnLine )
	var curTime = new Date().getTime();

	( function(url,data,curTime,defer){
		setTimeout( function(){ 

			$.ajax(url, prms ).then( 
				function(resp) {
					if ( QryBuilder.isAGSError(resp) ) {
						defer.reject( resp );
					}
					else {
						defer.resolve( resp );
					}
				},
				function(err) { defer.reject(err); }
			);

		}, curTime - QryBuilder._lastAGSquery > QryBuilder.minAGSqryPause ? 1 : QryBuilder.minAGSqryPause -  curTime + QryBuilder._lastAGSquery )
	})(url,data,curTime,defer);

	QryBuilder._lastAGSquery = curTime;

	return defer;
}

/**
 * Calculate extent for individual feature from JSON query response
 * @param  {!featureJSON} featureJSON - feature itself.
 * @param  {!string} geometryTypeEsri - esri type of geometry ( esriGeometryPoint | esriGeometryPolyline | esriGeometryPolygon).
 * @param  {boolean} [isWebMercator = flase] - Indicates that coordinates is a WebMercator. In this case used builtIn function to quick convert from XY to Lon/Lat.
 * @return {false | {min:number[], max:number[] }	- UL and DR corners.
 */
QryBuilder.computeExtent = function( featureJSON, geometryTypeEsri, isWebMercator ) {
	isWebMercator = isWebMercator || false;
	var geomType = QryBuilder.esri2geomType[geometryTypeEsri];
	var minArr = function(arr1,arr2){ return arr1.map( function(e,i){if ( e < arr2[i] ) return e; else return arr2[i]; })}
	var maxArr = function(arr1,arr2){ return arr1.map( function(e,i){if ( e > arr2[i] ) return e; else return arr2[i]; })}
	var max = [-Infinity, -Infinity, -Infinity],
		min = [Infinity, Infinity, Infinity];
	var cmpFunc = function(vertex) {
		if ( isWebMercator ) {
			vertex = QryBuilder.WebMercator2LatLon( vertex );
		}
		min = minArr( vertex, min );
		max = maxArr( vertex, max );
	}
	if ('point' === geomType) {
		return {
			"min": [featureJSON.geometry.x - 1, featureJSON.geometry.y - 1 ],
			"max": [featureJSON.geometry.x + 1, featureJSON.geometry.y + 1 ],
		}
	} else if ('line' === geomType) {
		featureJSON.geometry.paths.forEach( function(part){
			part.forEach( function(v){cmpFunc(v)});
		});
	} else if ('area' === geomType) {
			featureJSON.geometry.rings.forEach( function(part){
				part.forEach( function(v){cmpFunc(v)});
			});
	}

	return {
		"min": min,
		"max": max 
	}

}
/**
 * convert result returned from Esri Draw toolbar into object compliant for Esri REST API @see {@link http://resources.arcgis.com/en/help/arcgis-rest-api/index.html#/Buffer/02r3000000s5000000/}
 * @param  {!Object} inGeom 	- value returned from draw toolbar when drawing is done
 * @return { {geom: {geometryType:string, geometries:Array[]}, wkid:number} } 
 * @static
 */
QryBuilder.drawToolToGeom = function( inGeom ) {
	var g2Esri = {point:'esriGeometryPoint', polyline:'esriGeometryPolyline', polygon:'esriGeometryPolygon', extent:'esriGeometryPolygon'}
	var sWKID = inGeom.spatialReference.wkid,
		geom = {
			geometryType: g2Esri[inGeom.type],
			geometries:null,
		};
	if ( "polyline" === inGeom.type )
		geom.geometries = [{ paths:inGeom.paths }]
	else if ( "point" === inGeom.type ) 
		geom.geometries = [{x:inGeom.x, y:inGeom.y }]
	else if ( "polygon" === inGeom.type )
		geom.geometries = [{ rings:inGeom.rings }]
	else if ( "extent" === inGeom.type ) {
		var xmin = inGeom.xmin, xmax = inGeom.xmax, ymin = inGeom.ymin, ymax = inGeom.ymax;
		geom.geometries = [{ rings:[ [[xmin,ymin],[xmin,ymax],[xmax,ymax],[xmax,ymin],[xmin,ymin]] ]}];
	}

	return {geom:geom, wkid:sWKID} ;
}
/**
 * format value accoding to Esri field type
 * @param  {Object} fld 			- Esri field object.
 * @param  {string|number|null} value 	- Value to be formatted.
 * @return {string}
 */
QryBuilder.field2Text = function( fld, value ) {
	var type = fld.type;
	if ( null === value )
		return "";
	if ( "esriFieldTypeDate" === type ) {
		var d = new Date(value);
		var m = d.getUTCMonth() + 1
		return [m < 10 ? "0"+m : m, d.getUTCDate() <10 ? "0"+d.getUTCDate() : d.getUTCDate(), d.getUTCFullYear()].join('/') 
	} else if ( fld.domain && 'codedValue' === fld.domain.type) {
		var nv = fld.domain.codedValues.find( function(el){
			return el.code === value;
		})
		nv = nv ? nv.name : value;
		return String(nv);
	}

	return String( value )
}
QryBuilder.field2HTML = function( fldObject, value ) { return $("<DIV/>").text( QryBuilder.field2Text( fldObject, value ) ).html() }
/**
 * Convert point from Web Mercator Aux Sphere into longitude/latitude
 * @param {Number[x.y]} pnt - Array with x- and y-coordinates.
 * @return { Number[lon,lat]} - Array with corresponding longitude and lattitude.
 */
QryBuilder.WebMercator2LatLon = function(pnt) {
	var lon = (pnt[0] / 20037508.34) * 180;
	var lat = (pnt[1] / 20037508.34) * 180;

	lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
	return [lon, lat];
}
/**
 * Convert point from Web Mercator Aux Sphere into longitude/latitude
 * @param {Number[lon,lat]} pnt - Array with x- and y-coordinates.
 * @return { Number[x,y]} - Array with corresponding longitude and lattitude.
 */
QryBuilder.LatLon2WebMercator = function(pnt) {
	var x = pnt[0] * 20037508.34 / 180;
	var y = Math.log(Math.tan((90 + pnt[1]) * Math.PI / 360)) / (Math.PI / 180);
	y = y * 20037508.34 / 180;
	return [x, y];
}