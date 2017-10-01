/* #####################################################################################
#(c) Copyright 2015 by Denis Savitskiy
#for commercial and non-commercial use please contact me at balarpan_at_gmail.com
#####################################################################################
This code based on jQuery and jQuery UI plugins ( http://jquery.com and http://jqueryui.com )
*/

/** 
 * @module GUI
 * @version 1.1
 * @author Denis Savitskiy balarpan@gmail.com
 * @external QryBuilder
 */

'use strict';

//copied from JQuery UI. For full version refer to https://jqueryui.com/
(function($){
	$.fn.extend({
		focus: (function( orig ) {
			return function( delay, fn ) {
				return typeof delay === "number" ?
					this.each(function() {
						var elem = this;
						setTimeout(function() {
							$( elem ).focus();
							if ( fn ) {
								fn.call( elem );
							}
						}, delay );
					}) :
					orig.apply( this, arguments );
			};
		})( $.fn.focus ),

		disableSelection: (function() {
			var eventType = "onselectstart" in document.createElement( "div" ) ?
				"selectstart" :
				"mousedown";

			return function() {
				return this.bind( eventType + ".ui-disableSelection", function( event ) {
					event.preventDefault();
				});
			};
		})(),

		enableSelection: function() {
			return this.unbind( ".ui-disableSelection" );
		},

		zIndex: function( zIndex ) {
			if ( zIndex !== undefined ) {
				return this.css( "zIndex", zIndex );
			}

			if ( this.length ) {
				var elem = $( this[ 0 ] ), position, value;
				while ( elem.length && elem[ 0 ] !== document ) {
					// Ignore z-index if position is set to a value where z-index is ignored by the browser
					// This makes behavior of this function consistent across browsers
					// WebKit always returns auto if the element is positioned
					position = elem.css( "position" );
					if ( position === "absolute" || position === "relative" || position === "fixed" ) {
						// IE returns 0 when zIndex is not specified
						// other browsers return a string
						// we ignore the case of nested elements with an explicit value of 0
						// <div style="z-index: -10;"><div style="z-index: 0;"></div></div>
						value = parseInt( elem.css( "zIndex" ), 10 );
						if ( !isNaN( value ) && value !== 0 ) {
							return value;
						}
					}
					elem = elem.parent();
				}
			}

			return 0;
		}
	});    
})(jQuery);

var GUI = function(options) {}

/**
 * A progress bar.
 * @constructor
 * @param {Array[]} options									- Init options.
 * @param {[string|DOM|jQueryObject]} options.domNode 	- Where to place element. Can be ID of HTML element, DOM element or initialized jQuery DOM object. If null use Document.body as contaier.
 * @param {Number} options.step								- Step to increment which. Default is 1.
 */
GUI.Progress = function(options){
	this.options = $.extend( {
		step:1,
		min: 0,
		max: 1,
		domNode: null,
	}, options )
	this.options.domNode = GUI.DOMToObject( this.options.domNode );

	this.init();
}
GUI.Progress.prototype = {
	constructor: GUI.Progress,
	init: function(){
		this._container = $("<div class='guiProgressCont'><div class='guiProgress'></div></div>");
		this._progress = this._container.children().first();

		this._current = 0;

		this.options.domNode.append( this._container )
		this._update();
	},
	/**
	 * Set value of progress bar.
	 * @param {Number} value - A number represented new value of 
	 */
	set: function(value) { var v = Number(value); if( isFinite(v) ) this._current = GUI.clamp(v, this.options.min, this.options.max); this._update() },
	/**
	 * Set minimum and maximum bounds of progress bar.
	 * @param {Number} min  - Minimum value
	 * @param {Number} max - Maximum value
	 */
	setMinMax: function(min,max) { this.options.min = min; this.options.max = max; this._current = GUI.clamp( this._current, min, max); this._update() },
	/**
	 * Increment progress bar to one step.
	 */
	inc: function(){ this._current += this.options.step; this._update() },
	/** @ignore */
	_update: function(){
		var fL = this.options.max - this.options.min;
		var cL = this._current - this.options.min;
		var realWidth = this._container.width();
		var pWidth = GUI.clamp( realWidth * cL / fL, 0, realWidth );
		this._progress.css("width",parseInt(pWidth)+"px")
	},
	show: function(v) { this._container.show(v) },
	hide:function(v) { this._container.hide(v) },
	toggle:function(v) { this._container.toggle(v) },
	destroy:function() { this._progress.remove(); this._container.remove(); this._container = null; this._progress = null; },
}


//  A basic Window class
GUI.Window = function(in_opt) {
	this.container = null;
	this.mouseMode = null;
	this.init_opt = $.extend({
		container: null,
		headerText: 'window header',
		content: null,
		width: null, height: null,
		xPosition: null, yPosition: null, //can be 'center'|'left'|'right'|'top'|'bottom'
		zIndex:null,
		bShowOnCreate: true,
		isCloseable: true, isResizable: true,
		onClose: null, onResizeStart: null, onResizeEnd: null,
		onResizing: null,
	}, in_opt);
	if ("string" === typeof(this.init_opt.container)) this.container = $('#' + this.init_opt.container);
	else if ("object" === typeof(this.init_opt.container) && !this.init_opt.container) this.container = $('body');
	else this.container = $(this.init_opt.container);
	//if attache to body use z-index=1 else get them from parent element
	this.wnd_zIndex = this.init_opt.zIndex || this.container.zIndex() + 1;

	this.init_window();
}
GUI.Window.prototype={
	constructor: GUI.Window,
	init_window: function(){
		var scope = this;

		this.id = GUI.uuid()
		this.close_btn_id = GUI.uuid()
		this.wnd_cnt = $("<div class='wnd3d_cnt' id='" + this.id + "'></div>");
		this.wnd_header = $("<div class='wnd3d_header_cnt'><div class='wnd3d_header'>" +
			GUI.htmlEscape(this.init_opt.headerText) + "</div></div>" +
			(this.init_opt.isCloseable ? "<button class='wnd3d_close_btn' type='button' id='" + this.close_btn_id+"'></button>" : '') );
		this.wnd_footer = $("<div class='wnd3d_footer_cnt'></div>")
		if ( this.init_opt.isResizable ) {
			this.wnd_resize_anchor = $("<div class='resize_anchor'></div>")
			this.wnd_resize_anchor.mousedown( function(e){scope.onResizeMouseDown(e)})
			this.wnd_footer.append( this.wnd_resize_anchor )
		}
		this.wnd_body=$("<div class='wnd3d_body_cnt'><div class='wnd3d_body'></div></div>")
		if (this.init_opt.content)
			this.wnd_body.children('.wnd3d_body').append( $(this.init_opt.content) )
		// this.wnd_body.children(":first").addClass('scrollbar-rail')
		// this.wnd_body.children(":first").scrollbar( {disableBodyScroll:true,} );

		this.wnd_cnt.css({'z-index':this.wnd_zIndex, 'position':'absolute'})
		this.wnd_header.disableSelection();

		this.wnd_cnt.append( this.wnd_header );
		this.wnd_cnt.append( this.wnd_body );
		this.wnd_cnt.append( this.wnd_footer );

		this.wnd_header.mousedown( function(e){scope.onHeaderMouseDown(e)})
		
		this.wnd_cnt.css({display:'none'})
		// this.container.get(0).appendChild( this.wnd_cnt.get(0) )
		if ('center' === this.init_opt.xPosition)
			this.wnd_cnt.css({left:parseInt(this.container.width()/2-this.wnd_cnt.width()/2)+'px'})
		if ('center' === this.init_opt.yPosition)
			this.wnd_cnt.css({top:parseInt(this.container.height()/2-this.wnd_cnt.height()/2)+'px'})
		if ('right' === this.init_opt.xPosition)
			this.wnd_cnt.css({left:parseInt(this.container.width()-this.wnd_cnt.width())+'px'})
		if ('bottom' === this.init_opt.yPosition)
			this.wnd_cnt.css({top:parseInt(this.container.height()-this.wnd_cnt.height())+'px'})

		this.container.append( this.wnd_cnt )

		$('#'+this.close_btn_id).click(function(){scope.show(false)})

		this.show( this.init_opt.bShowOnCreate )
	},
	show: function(bShow){
		if(bShow) {
			this.wnd_cnt.show(300);
			GUI.shiftToviewport( this.wnd_cnt );
		}
		else
			this.wnd_cnt.hide(300);
	},
	setMouseMode: function(mode){this.mouseMode=mode; },
	cleanMouseMode: function(){ 
		this.setMouseMode();
		$('body').off('mousemove');
		// this.wnd_header.off('mouseleave');
		$('body').off('mouseup');
		this.container.enableSelection()
		this.container.get(0).style.cursor = 'default'
	},
	onHeaderMouseDown: function(e){
		e.stopPropagation();

		this.mouse_xdiff=e.pageX-this.wnd_cnt.position().left;
		this.mouse_ydiff=e.pageY-this.wnd_cnt.position().top;
		var self=this;
		this.setMouseMode('header_drag');
		$('body').on('mousemove', function(e){self.onMouseMove(e)})
		// this.wnd_header.on('mouseleave', function(e){self.onMouseLeave(e)})
		$('body').on('mouseup', function(e){self.onMouseUp(e)})
		$(this.container).disableSelection() //prevent selection when mouse goes outside DIV element
		this.cWi=this.container.width()
		this.cHe=this.container.height();
		this.wWi=this.wnd_cnt.width();
		this.wHe=this.wnd_cnt.height();
		this.container.get(0).style.cursor='move';
	},
	onResizeMouseDown: function(e) {
		e.stopPropagation();

		this.mouse_xdiff = e.pageX - this.wnd_cnt.width() ;
		this.mouse_ydiff = e.pageY - this.wnd_cnt.height() ;
		var self = this;
		this.setMouseMode('resize_drag');
		$('body').on('mousemove', function(e){self.onMouseMove(e)})
		$('body').on('mouseup', function(e){self.onMouseUp(e)})
		$(this.container).disableSelection() //prevent selection when mouse goes outside DIV element
		this.cWi = this.container.width()
		this.cHe = this.container.height();
		this.wWi = this.wnd_cnt.width();
		this.wHe = this.wnd_cnt.height();

		if ( 'function' === typeof(this.init_opt.onResizeStart) )
			this.init_opt.onResizeStart( e, this )
	},
	onMouseMove: function(e){
		if ( !this.mouseMode )
			return

		var new_left = e.pageX - this.mouse_xdiff; 
		var new_top = e.pageY - this.mouse_ydiff; 
		if ( 'header_drag' === this.mouseMode) {
			 
			if (new_left + this.wWi > this.cWi)
				new_left = this.cWi - this.wWi
			if (new_top + this.wHe > this.cHe)
				new_top = this.cHe - this.wHe
			if (new_left< 0) new_left = 0;
			if (new_top< 0) new_top = 0;

			this.wnd_cnt.css({
			 top: parseInt(new_top)+"px",
			 left: parseInt(new_left)+"px",
			});
			GUI.shiftToviewport( this.wnd_cnt );
		} else if ( 'resize_drag' === this.mouseMode ){
			if (new_left < 10 )
				new_left = 10
			if (new_top < 10 )
				new_top = 10
			this.wnd_cnt.css({
			 width: parseInt(new_left)+"px",
			 height: parseInt(new_top)+"px",
			});
			if ( 'function' === typeof(this.init_opt.onResizing) )
				this.init_opt.onResizing(e,this)
		}
	},
	onMouseUp: function(e){ this.cleanMouseMode(); },
	onMouseLeave: function(e){ this.onMouseUp(e) },
	destroy: function(){this.setMouseMode(); this.container.get(0).removeChild(this.wnd_cnt.get(0)); this.wnd_cnt=null; this.wnd_header.off(); this.wnd_header=null;this.wnd_body=null;},
	bodyWidth: function(){ return this.wnd_body.width() },
	bodyHeight: function(){ return this.wnd_body.height()-20 },
}

/**
 * Data Grid with infinite scroll
 * @class
 * @param {Object} opt - Initialization options
 */
GUI.DataGrid = function( opt ) {
	this.opt = $.extend( {
		/**
		 * A DOM element or ID of DOM Element which will be host DataGrid
		 * @type {Object|String}
		 */
		container: null,
		/**
		 * Can be a function. Other types of data source not yet implemented. Function must return Promise/A+ object.
		 * Function receive following object
		 * {
		 * 	from: Number,
		 * 	to: number,
		 * 	filters:[],
		 * 	sortcolumn:[],
		 * 	countOnly: boolean
		 * }
		 * @type {function}
		 */
		dataSource: null,
		/**
		 * Number of preloaded rows on top and bottom from current view area
		 * @type {Number}
		 */
		numRowsPreload: 50,
		/**
		 * columns definition. Must be in form of {name:'', type:''}
		 * @type {Array}
		 */
		cols: [],
		/**
		 * Automatically increase min width of column when data inside column are growth Object.<name:string, filter:boolean> 
		 * @type {Boolean}
		 */
		autoupdateColsWidth: true,
		totalRows:0,
		/**
		 * Cell click event function. Function will be called with following params: 1) row number, 2) cell index, 3) array of row values
		 * @type {function|null}
		 */
		onClick:null
	}, opt )
	console.assert( this.opt.container, "You must provide DOM container for DataGrid!");
	console.assert( 'function' === typeof(this.opt.dataSource), "You must provide dataSource for DataGrid!");
	this.opt.container = "string" === typeof( this.opt.container ) ? $("#"+this.opt.container) : $(this.opt.container);
	this._curRow = 0;
	Object.defineProperty(this, 'totalRows', {
		enumerable: true,
		get: function(){ return this.opt.totalRows},
		set: function(v){
			this.opt.totalRows = v;
			this.setTotalRows();
		}
	});
	this.init();
}
GUI.DataGrid.prototype = {
	constructor: GUI.DataGrid,
	init: function(){
		var scope = this;

		this._gridCnt = $("<div class='guiDatagrid_cnt'><div class='guiDatagrid'><div class='guiDatagridHeader_cnt'></div> <div class='guiDatagridBody_cnt'>\
			<TABLE class='guiDatagridBody'><TBODY></TBODY></TABLE></div> </div></div>")
		this.opt.container.append( this._gridCnt )
		this._header = this._gridCnt.find('.guiDatagridHeader_cnt:first')
		this.opt.cols.forEach( function(col){
			var txt = GUI.htmlEscape(col.name)
			scope._header.append('<div class="guiDatagridHeader" title="' + txt +'">' + 
				txt + (col.filter ? '<input class="guiDatagridFilter" type="search">' : '') + '</div>');
		})
		//compensate scrollbar width of gridBody scrollbar
		this._header.append('<div class="guiDatagridHeaderBar" style="visibility:hidden; width:' + GUI.getScrollbarWidthHeight().width +'px;"></div>')

		var nextZ = this._gridCnt.zIndex()+1;
		this._busyMsg = $("<div class='guiDatagridBusy'/>").css({'zIndex':nextZ, opacity:0});
		this._progress = $("<progress class='guiProgressLine guiDatagridLaodingLine'></progress>").css({'zIndex':nextZ, opacity:0});
		this._header.append( this._progress )
		this._gridCnt.append( this._busyMsg )

		this._body = this._gridCnt.find('.guiDatagridBody:first').children('TBODY:first')
		//compute row height
		this._body.append('<tr class="guiDatagridRow"><td class="guiDatagridCell">&nbsp;</td></tr>')
		//let the browser draw DOM elements before we make measure of row height
		setTimeout( function(){
			//set height of the body for enable CSS overflow scroller
			this._bodyCnt = this._gridCnt.find('.guiDatagridBody_cnt:first').css('height', parseInt(this.opt.container.innerHeight() - this._header.outerHeight(true)) + 'px');

			scope._rowHeight = scope._body.children('TR:first').innerHeight()
			scope._body.children('TR').remove()
			scope._marginBefore = $('<div class="guiDatagridMargin"/>')
			scope._marginAfter = $('<div class="guiDatagridMargin"/>')
			scope._body.parent().before( scope._marginBefore ); scope._body.parent().after( scope._marginAfter );

			scope._maxVisible = parseInt( scope._bodyCnt.innerHeight() / scope._rowHeight )
			
			//for proper compute initial column width after setting totalRows hide input fields
			scope._header.find('input.guiDatagridFilter').hide();
			scope.qryTotalRows().then( function(){
				scope._header.find('input.guiDatagridFilter').show().on("change search", scope.onFilterChange.bind(scope) );
				scope._marginBefore.css('width', scope._header.get(0).scrollWidth )
				scope._marginAfter.css('width', scope._header.get(0).scrollWidth )
			})


			// scope._header.scroll( function(e){scope._bodyCnt.scrollLeft( scope._header.scrollLeft() ); });
			scope._bodyCnt.scroll( scope.scrollEvt.bind(scope) )
			if ( 'function' === typeof scope.opt.onClick )
				scope._body.click( scope.onCellClick.bind(scope) )
		}.bind(this), 350)
	},
	/**
	 * Query count of rows
	 * @return {Promise} [description]
	 */
	qryTotalRows: function(){
		var scope = this;

		scope.busyMsg( true )
		//get rows count
		return scope.opt.dataSource( $.extend(scope.buildQry(),{countOnly: true}) ).then( function(count){
			scope.busyMsg( false )
			scope.totalRows = count;
			// scope.setTotalRows();
			
			return count;
		}, function(err){ scope.busyMsg(false); console.error("error getting rows count", err); return err;} );
	},
	/**
	 * Called after total count of rows parameter has been changed.
	 */
	setTotalRows: function(){
		this._cache = {
			start:Infinity,
			end:-Infinity,
			data:[]
		};
		this._curRow = 0;
		this._maxLastPage = GUI.clamp( this.totalRows - this._maxVisible, 0, this.totalRows )
		this._view = {
			from: GUI.clamp( this._curRow - this.opt.numRowsPreload, 0, this.totalRows ),
			to: GUI.clamp( this._curRow + this._maxVisible + this.opt.numRowsPreload, 0, this.totalRows )
		}
		this.emptyRowTemplate = '<tr class="guiDatagridRow">' +
			this.opt.cols.map( function(){return '<td class="guiDatagridCell">&nbsp;</td>'}).join('') +
			'</tr>';
		this._body.children('TR').remove()
		for( var i = this._view.from; i < this._view.to; i++)
			this._body.append( this.emptyRowTemplate );

		this.updateView( {from:Infinity, to:-Infinity} );
		this.updColsWidth()
		this.scrollEvt()
	},
	//update height of upper and lower empty blocks around table
	updateMargins:function(){
		var before = GUI.clamp(this._view.from, 0, this._maxLastPage) ;
		var after = GUI.clamp(this.totalRows - this._view.to, 0, this.totalRows);
		this._marginBefore.css('height', parseInt(before * this._rowHeight+1)+'px')
		this._marginAfter.css('height', parseInt(after * this._rowHeight +1)+'px')
		this._marginBefore.css('width', this._header.get(0).scrollWidth )
		this._marginAfter.css('width', this._header.get(0).scrollWidth )
	},
	updateView:function( viewMatrix ){
		var scope = this;
		var _view = viewMatrix ? viewMatrix : this._view;

		var endRow = GUI.clamp( this._curRow + this._maxVisible, 0, this.totalRows);
		if ( GUI.clamp(this._curRow,_view.from,_view.to - 1) === this._curRow && GUI.clamp(endRow,_view.from,_view.to - 1) === endRow )
			return;
		var start = GUI.clamp( this._curRow - this.opt.numRowsPreload, 0, this.totalRows );
		var end = GUI.clamp( this._curRow + this._maxVisible + this.opt.numRowsPreload, 0, this.totalRows );
		this._view.from = start;
		this._view.to = end;
		this.clampTable();
		this.updateMargins();

		var rowsFunc = function(rows){
			scope._body.find('TR').each( function(iTR){
				$(this).find('TD').each( function(iTD){
					this.innerHTML = GUI.htmlEscape( rows[iTR][iTD] );
				});
			});
			scope.updColsWidth()

			return rows;
		}
		if ( !this.validateCache(start,end) ) {
			//query from external source
			this.busyMsg( true );
			setTimeout( function() {
				scope._body.find('TD').each( function(){this.innerHTML='&nbsp;'});
				
				scope.qryRows( start, end )
				.always( function(r){ scope.busyMsg(false); return r;} )
				.done( rowsFunc )
				.fail( function(err){ console.error("Error getting DataGrid rows", err)} );
			}, 20);
		}
		else {
			//cache hit
			this.busyMsg( false )
			this.qryRows( start, end ).done( rowsFunc );
		}
	},
	validateCache:function(vfrom,vto){
		return this._cache.start !== Infinity && 
			GUI.clamp( vfrom, this._cache.start, this._cache.end ) === vfrom && 
			GUI.clamp( vto, this._cache.start, this._cache.end ) === vto; 
	},
	wipeCache:function(){
		this._cache = {
			start:Infinity,
			end:-Infinity,
			data:[]
		};
		this.updateView();
	},
	/**
	 * Query a slice of table rows.
	 * @param  {Number} rFrom 		- start index
	 * @param  {Number} rTo   		- end index
	 * @return {Promise.<Array>}	- Resulting Array with queried values
	 */
	qryRows:function( rFrom, rTo ) {
		var scope = this;

		var defer = $.Deferred();
		if ( this.validateCache(rFrom, rTo) ) {
			//cache hit
			defer.resolve( this._cache.data.slice(rFrom-this._cache.start, rTo - this._cache.start) )
		}
		else {
			var myFrom = GUI.clamp( rFrom - this.opt.numRowsPreload, 0, this.totalRows );
			var myTo = GUI.clamp( rTo + this.opt.numRowsPreload + this._maxVisible, 0, this.totalRows );
			var qry = $.extend( scope.buildQry(), {
				from:myFrom,
				to:myTo
			});

			(function(scope, qry, myFrom, myTo, rFrom, rTo, defer, view){
				scope.opt.dataSource( qry ).then(
					function(rows){
						//asynchronous query concurency 
						if ( view.from !== scope._view.from || view.to !== scope._view.to ) {
							defer.reject( rows );
							return defer;
						}
						scope._cache.start = myFrom;
						scope._cache.end = myTo;
						scope._cache.data = rows;
						defer.resolve( rows.slice(rFrom - myFrom, rTo - myFrom) );
					},
					function(err){ defer.reject(err) });
			})(scope, qry, myFrom, myTo, rFrom, rTo, defer, this._view);
		}

		return defer.promise()
	},
	scrollEvt: function(){
		this._header.scrollLeft( this._bodyCnt.scrollLeft() )

		if ( this.scrollTimer )
			 clearTimeout(this.scrollTimer)
		this.scrollTimer = setTimeout( this.scrollEvt_func.bind(this), 50);
	},
	scrollEvt_func:function(){
		this._curRow = GUI.clamp( parseInt( this._bodyCnt.scrollTop() / this._rowHeight ), 0, this._maxLastPage)
		this.updateView();
		this.scrollTimer = null;
	},
	/**
	 * clamp table rows count according to viewMatrix param
	 * @param  {null|Object} viewMatrix - COrresponding top and bottom rows in table or null for use actual values
	 * @param  viewMatrix.from 			- top row of table
	 * @param  viewMatrix.to 			- bottom row of table
	 * @return {boolean}            	- If true table rows count are equal to view matrix params, flase value indicated that table rows has been fit to desired values.
	 */
	clampTable:function(viewMatrix){
		var _view = viewMatrix ? viewMatrix : this._view;

		var l = this._body.find('TR').length, size = _view.to - _view.from;

		if ( size === l )
			return true;
		var delta = size - l
		if ( l < size) {
			//add extra rows
			for ( var i=0; i<delta; i++) {
				this._body.append( this.emptyRowTemplate )
			}
		}
		else {
			//remove part of rows at the bottom
			this._body.find('TR').get().reverse().slice(0, -delta).forEach( function(tr){ $(tr).remove();})
		}
	},
	/**
	 * Update columns width according to the data columns
	 * @param  {boolean} forceFitHeader - Fit header to column width regardless of autofit settings.Useful after initialization of table.
	 */
	updColsWidth: function( forceFitHeader ){
		if ( !this.opt.autoupdateColsWidth )
			return
		var scope = this;
		var row = this._body.children().first().children()
		var wFunc = function( ind, oldValue ) {
			var cell = $(row[ind])
			var w = cell.width()
			// if( ind >= scope.opt.cols.length )
			// 	return GUI.getScrollbarWidthHeight().width + 'px'
			scope.opt.cols[ind].minWidth = scope.opt.cols[ind].minWidth || $(this).width()
			if ( !scope.opt.autoupdateColsWidth || forceFitHeader ) {
				//always fit to the column width
				scope.opt.cols[ind].minWidth = w
			}
			else {
				//enlarge width only if columns bigger than current header width
				scope.opt.cols[ind].minWidth = Math.max( w, scope.opt.cols[ind].minWidth )
				cell.css('minWidth', scope.opt.cols[ind].minWidth )
			}
			return scope.opt.cols[ind].minWidth + 'px'
		}
		this._header.children('.guiDatagridHeader').css('width', wFunc );
	},
	buildQry: function(){
		var ret = { filters:[], sorting:[] };
		this._header.children('.guiDatagridHeader').each( function(){
			ret.filters.push( $(this).find('.guiDatagridFilter').first().val() )
		})
		return ret;
	},
	busyMsg: function( isBusy ){
		var param = {
			opacity: isBusy ? 1.0 : 0,
		};
		[ this._busyMsg, this._progress ].forEach(function(el){ el.stop().animate(param, 750); } );
	},
	onCellClick: function( e ){
		if ( !this.opt.onClick || e.target.tagName !== 'TD' )
			return
		e.stopPropagation();

		var rowNumber = e.target.parentNode.rowIndex + this._view.from;
		this.opt.onClick( rowNumber,
			e.target.cellIndex,
			this._cache.data.slice(rowNumber - this._cache.start, rowNumber - this._cache.start + 1),
			e);
		return e;
	},
	onFilterChange: function(e){ if ( !this.isUpdating ) this.qryTotalRows(); },
	clearFilters: function(){
		//if all filters are empty do not reload data
		if( !(this._header.find('input.guiDatagridFilter').filter(function () {return !!this.value;}).length) )
			return;

		this.isUpdating = true;
		this._header.find('input.guiDatagridFilter').val('');
		this.isUpdating = false;
		this.qryTotalRows();
	},
	/**
	 * Mass-update filters values
	 * @param {Array.<string>} inputs - Array of appropriate strings.
	 */
	setFiltersVal: function( inputs ){
		this.isUpdating = true;

		this._header.find('.guiDatagridHeader').each( function(ind){
			if ( inputs.length -1 < ind)
				return;
			$(this).find('input.guiDatagridFilter').first().val( inputs[ind] );
		});

		this.isUpdating = false;
		this.qryTotalRows();
	},
}

/**
 * Wrapper for create GUI.DataGrid to view attributes from Feature Class
 * @class
 * @extends GUI.DataGrid
 * @param {Object} opt - An options for GUI.DataGrid and GUI.AttrTable
 */
GUI.AttrTable = function( opt ){
	var scope = this;
	this.opt = $.extend( {
		/**
		 * URL of Feature class published on AGOL or ArcGIS Server
		 * @type {string}
		 */
		urlFC: null,
		dataSource: this.dataSource.bind(this)
	}, opt );
	QryBuilder.qryJSON( this.opt.urlFC, {} ).done( function(r){
		scope.myDataDesc = r;
		scope.myFields = r.fields.filter( function(fld){ return "esriFieldTypeGeometry" !== fld.type});
		scope.opt.cols = scope.myFields.map(function(el){return {name:el.alias.length ? el.alias : el.name, filter:el.type!=='esriFieldTypeDate'};});

		//invoke parent class constructor
		GUI.DataGrid.call( scope, scope.opt );
	}).fail( function(err){ console.error("Error reading feature class web-service " + scope.opt.urlFC, err)});
}
GUI.AttrTable.prototype = Object.create(GUI.DataGrid.prototype)
/**
 * quering web-service for appropriate rows
 * @ignore
 * @param  {Object} qry Query parametrs. See @see {@link GUI.DataGrid} for list of the params of dataSource option.
 * @return {Promise.<Array> | Promise.<Number>}     Return a promise which will be resolved into array of appropriate rows or number, repersenting count of rows in case of countOnly param = true.
 */
GUI.AttrTable.prototype.dataSource = function( qry ){ 
	var scope = this;
	var def = $.Deferred();

	var where = qry.filters.map(function(el, ind) {
		if (!el || !el.length)
			return;
		var fld = scope.myFields[ind]
		var val = "esriFieldTypeString" === fld.type ? "'" + QryBuilder.escapeSQL(el) + "'" : QryBuilder.escapeSQL(el);
		var operand = '='
		if (0 <= val.indexOf('*')) {
			if ("esriFieldTypeString" === fld.type) {
				val = "'" + QryBuilder.escapeSQL(el).split('*').join('%') + "'"
				operand = ' LIKE '
			} else {
				val = val.split('*').join('')
			}
		}
		return scope.myFields[ind].name + operand + val;
	})
	.filter(function(el) {
		return !!el;
	})
	.join(' AND ')
	where = where.length ? where : '1=1'
		// console.debug( qry, where )

	QryBuilder.qryJSON(this.opt.urlFC + '/query', {
		outFields: '*',
		returnGeometry: false,
		where: where,
		resultOffset: (qry.countOnly || (qry.to - qry.from <= 0)) ? undefined : qry.from,
		resultRecordCount: (qry.countOnly || (qry.to - qry.from <= 0)) ? undefined : qry.to - qry.from,
		returnCountOnly: qry.countOnly,
	}).then(function(r) {
		if (qry.countOnly)
			return def.resolve(r.count);
		var fields = scope.myFields;
		var ret = [];

		r.features.forEach(function(feat) {
			ret.push(fields.map(function(fld) {
				return feat.attributes[fld.name];
			}));
		})

		return def.resolve(ret);
	}, function(err) {
		def.reject(err);
	});

	return def;
}

GUI.PopupMenu = function( opt ) {
	this.opt = $.extend( {
		/**
		 * Array of menu items. Each item is a dicionary {text:'', html:'', onClick:function}
		 * @type {Array}
		 */
		items:[],
		/** @type {Number} z-index of the PopupMenu */
		zIndex:999,
	}, opt);
	this.init();
}
GUI.PopupMenu.prototype = {
	constructor: GUI.PopupMenu,
	init: function(){
		var scope = this; 
		this.menuCnt = $("<div class='guiPopupCont'><ul class='guiPopup'></ul></div>").css({zIndex:this.opt.zIndex, display:'none'})
		this.menu = this.menuCnt.children('.guiPopup').first()
		this.opt.items.forEach( function(item){ 
			var li = $("<li class='guiPopupItem'></ii");
			scope.menu.append( li.append( item.html ? $(item.html) : GUI.htmlEscape(item.text) ) );
		})

		$("BODY").append( this.menuCnt )
	},
	popup: function(offset){
		this.menuWidth = this.menuCnt.outerWidth(true);
		this.menuHeight = this.menuCnt.outerHeight(true);
		this.left = offset.left;
		this.top =  offset.top;
		var vTop  = window.pageYOffset || document.documentElement.scrollTop + 2 ,
		    vLeft = window.pageXOffset || document.documentElement.scrollLeft + 2 ;
		var viewBox = [ vLeft, vTop, GUI.viewportWidth() + vLeft - 2, GUI.viewportHeight() + vTop -2 ]
		var posBox = GUI.shiftBoxToParent( this.getMenuBox(), viewBox )
		this.left = posBox[0];
		this.top =  posBox[1];
		this.menuCnt.css({top:this.top, left:this.left}).show();
		$(window).on("click mousewheel scroll keydown", "", this.clickHandler.bind(this) )
	},
	hide: function(){
		$(window).off("click mousewheel scroll", "", this.clickHandler.bind(this) )
		this.menuCnt.hide();
	},
	clickHandler: function( e ) {
		if( "click" === e.type && GUI.isPntInBox([e.pageX, e.pageY], this.getMenuBox()) ) {
			var target = $(e.target).closest('LI.guiPopupItem')
			if ( target.length ) {
				var item = this.opt.items[ $(target[0]).index() ]
				this.hide();
				if ( item.onClick )
					item.onClick(e);
			}
		}
		else {
			this.hide()
		}
	},
	getMenuBox:function(){ return [ this.left, this.top, this.left  + this.menuWidth, this.top + this.menuHeight ]; },
}

/**
 * Carousel with smooth scrolling. Can be vertical or horizaontal oriented.
 * @class
 * @constructor
 * @param {Array[]} in_opt 								- Init params.
 * @param {string|domID|jQuery.Object} in_opt.dom_container 	- A DOM element, ID of DOM Element or jQuery object.
 * @param {string} [in_opt.id]							- If you need you can assign to the control desired ID, otherwise id will be generated automatically.
 * @param {string} [in_opt.orientation='vertical'] 		- Can be 'horizontal' or 'vertical'. Default is 'vertical'
 * @param {string} [in_opt.itemCSS] 					- Style which will be assigned to each item in Carousel.
 */
GUI.Carousel = function ( in_opt ) {
	/** @constructor */
	this._opt = $.extend( {
		dom_container:null, id:null,
		orientation:'vertical',
		itemCSS:'',
		mouseWheelMultiply : 1,
		onClick:null}, in_opt );
	this._opt.type = this._opt.orientation==='vertical' ? 'vert' : 'horiz';
	this._opt.typeCSS = (this._opt.itemCSS.length > 0 ? this._opt.itemCSS+' ' : '')+this._opt.type;
	if ( !this._opt.id ) this._opt.id=GUI.uuid();
	this.build();
};
GUI.Carousel.prototype = {
	constructor: GUI.Carousel,
	build:function() {
		var parent = GUI.DOMToObject( this._opt.dom_container );
		var el = $('<div class="Carousel3dcnt '+this._opt.type+'" id="'+this._opt.id.toString()+'"><div class="Carousel3d '+this._opt.type+'"></div></div>');
		el.disableSelection();
		if ( null!==parent )
			parent.append(el);
		this._dom = el.children().first();
		this.bindEvents();
	},
	bindEvents: function(){
		this._dom.on('mousewheel', this.onMouseWheel.bind(this) );
	},
	unbindEvents: function(){ this._dom.off(); },
	onMouseWheel: function(event){
		var dist = event.deltaFactor * event.deltaY  * this._opt.mouseWheelMultiply;
		this.scrollBy( 0-dist );
	},
	scrollBy: function( scrollDelta ){
		if ( 0===scrollDelta )
			return;
		this._dom.stop( true );
		var vert = this.isVertical;
		var size = vert ? this._dom.parent().height() : this._dom.parent().width(), viewStart = vert ? 0-parseInt(this._dom.css('top')) : 0-parseInt(this._dom.css('left')), viewCenter = viewStart + size/2;
		var space = vert ? this._dom.height() : this._dom.get(0).scrollWidth;

		var delta = parseInt( GUI.clamp( viewStart + scrollDelta, 0, space-size ) );
		delta = delta - viewStart;
		if ( 0!== delta ){
			var anim = vert ? {'top':'-='+delta+'px'} : {'left':'-='+delta+'px'};
			this._dom.animate(
				anim,
				{
					'duration': parseInt( Math.abs(delta)/1200*1000) , //speed = 1200 pixels per second + compensation for dist<50px (actual for easing=swing)
					'queue': false,
					'easing':'linear',
				});
		}
	},
	/**
	 * Add itme to Carousel.
	 * @param {DOM|string} in_it   Can be dom element. html string or jQuery dom element.
	 * @param {any} in_data 		Any data that will be assigned to the element and can be letter used viq jQuery data() function.
	 */
	addItem:function( in_it, in_data ) {
		var self = this;
		var item = $(in_it);
		var el = $('<div class="Carousel3dItem inactive '+this._opt.typeCSS+'">');
		el.click( self.itemClick.bind(self) );
		this._dom.append( el.append( item ) );
		var ret = this._dom.children().length -1;
		el.data( {num:ret, userData:in_data} );
		return ret;
	},
	itemClick: function(e) {
		e.preventDefault();

		var el = $(e.delegateTarget);
		this.selectItem( el.data().num );

		if( "function"===typeof(this._opt.onClick) ) {
			this._opt.onClick.call( this, e, el.data().userData );
		} 
	},
	selectItem: function( itemNumber ) {
		if ( 0>itemNumber || itemNumber > this.itemsCount - 1 )
			return;
		var self = this;
		var vert = this.isVertical;
		this._dom.stop( true );
		var el = this.getItem(itemNumber), num = el.data().num+1, size = vert ? this._dom.parent().height() : this._dom.parent().width(), itemSize = vert ? el.outerHeight() : el.outerWidth();
		itemSize += vert ? (parseInt( el.css('margin-bottom') ) + parseInt( el.css('margin-top') )) : (parseInt( el.css('margin-left') )+parseInt( el.css('margin-right') ));
		var itemStart = vert ? el.position().top : el.position().left, itemStop = itemStart + itemSize;
		var viewStart = vert ? 0-parseInt(self._dom.css('top')) : 0-parseInt(self._dom.css('left')), viewCenter = viewStart + size/2;
		var deltaToCenter = itemStart - viewCenter + itemSize/2, space = vert ? this._dom.height() : this._dom.get(0).scrollWidth;

		this._dom.children().removeClass('active').addClass('inactive');
		el.removeClass('inactive').addClass('active');

		if ( viewStart+deltaToCenter > space-size ) {
			deltaToCenter = (space-size) - viewStart;
		}
		if ( viewStart+deltaToCenter < 0 ) {
			deltaToCenter = 0 - viewStart;
		}
		deltaToCenter = parseInt( deltaToCenter );

		//only if item is smaller than container we move Item to center 
		if ( itemSize < size) {
			var anim = vert ? {'top':'-='+deltaToCenter+'px'} : {'left':'-='+deltaToCenter+'px'};
			this._dom.animate(
				anim,
				{
					'duration': parseInt( Math.abs(deltaToCenter)/300*1000) + parseInt(50/Math.abs(deltaToCenter)*1000), //speed = 300 pixels per second + compensation for dist<50px (actual for easing=swing)
					'queue': false,
					// 'easing':'linear',
				});
		}
	},
	getItem: function( itemNumber ) { return $(this._dom.children()[itemNumber]); },
	getUserData: function( itemNumber ) { return this.getItem(itemNumber).data().userData; },
	//return true if orientation of Carousel is vertical
	get isVertical() {
		return this._opt.type === 'vert';
	},
	get itemsCount() { return this._dom.children().length; },
};

/**
 * Color Gradient.
 * @class
 * @constructor
 * @param {Array[]} in_opt 									- Init params.
 * @param {string} in_opt.colorStart 	- A hex string, repersnt a color.
 * @param {string} in_opt.colorEnd 		- A hex string, repersnt a color.
 * @param {string} [in_opt.id]							- If you need you can assign to the control desired ID, otherwise id will be generated automatically.
 */
GUI.Gradient = function ( in_opt ) {
	/** @constructor */
	this._opt = $.extend( {
		colorStart:'#000000',
		colorEnd:'#ffffff'}, in_opt );
	this.build();
};
GUI.Gradient.prototype = {
	constructor: GUI.Carousel,
	build: function(){
		this._opt.startRGB = this.convertToRGB( this._opt.colorStart )
		this._opt.endRGB = this.convertToRGB( this._opt.colorEnd )
	},
	/**
	 * Get color from gradient.
	 * @param  {Number} percent Value between 0 and 1
	 * @return {string}            A hex representation of color
	 */
	getHexColor: function(percent){ return this.convertToHex( this.getRGBColor(percent) ) },
	/**
	 * Get color from gradient.
	 * @param  {Number} percent Value between 0 and 1
	 * @return {Array[]}         Array of RGB values
	 */
	getRGBColor: function(percent){
		var c = [];
		c[0] = parseInt(this._opt.startRGB[0] * percent + (1 - percent) * this._opt.endRGB [0]);
		c[1] = parseInt(this._opt.startRGB[1] * percent + (1 - percent) * this._opt.endRGB [1]);
		c[2] = parseInt(this._opt.startRGB[2] * percent + (1 - percent) * this._opt.endRGB [2]);
		return c;
	},
	getRGBstring: function(percent){
		var c = this.getRGBColor( percent );
		return 'rgb(' + c.join(',') +')';
	},
	/* Remove '#' in color hex string */
	trim: function(s){ return (s.charAt(0) == '#') ? s.substring(1, 7) : s },
	/* Convert a hex string to an RGB triplet */
	convertToRGB: function(hex){
		var color = [];
		color[0] = parseInt((this.trim(hex)).substring(0, 2), 16);
		color[1] = parseInt((this.trim(hex)).substring(2, 4), 16);
		color[2] = parseInt((this.trim(hex)).substring(4, 6), 16);
		return color;
	},
	/* Convert an RGB triplet to a hex string */
	convertToHex: function(rgb){ return this.hex(rgb[0]) + this.hex(rgb[1]) + this.hex(rgb[2]) },
	hex: function(c){
		var s = "0123456789abcdef";
		var i = parseInt(c);
		if (i == 0 || isNaN(c))
			return "00";
		i = Math.round(Math.min(Math.max(0, i), 255));
		return s.charAt((i - i % 16) / 16) + s.charAt(i % 16);
	},
}

//Static variables
// next free DOM ID value @static
GUI.nextID = 0;
//Path to folder where gui.js is stored @static
GUI.script_folder = null;

//static functions

//Get uniq identifier for DOM element
GUI.uuid = function() { GUI.nextID += 1; return 'gui'+GUI.nextID.toString(32); };
GUI.clamp = function( val, in_min, in_max ) { return Math.max( in_min, Math.min( in_max, val ) ); };
/**
 * Check that point lie inside box.
 * @param  {Array[Number]}  pt  - Point to test.
 * @param  {Array[Number]}  box - A box wit upper-left and lower-right coordinates.
 * @return {Boolean}     		- Return true if point lie inside box.
 */
GUI.isPntInBox = function( pt, box ){ return pt[0] >= box[0] && pt[0] <= box[2] && pt[1]>=box[1] && pt[1] <= box[3] };
GUI.shiftBoxToParent = function( in_box, parent ){ 
	if( GUI.isPntInBox(in_box.slice(0,2),parent) && GUI.isPntInBox(in_box.slice(2,4),parent) )
		return in_box;
	var box = in_box.slice();
	var shFunc = function( delta, isX ) {
		var shift = isX ? 0 : 1;
		box[0+shift] += delta
		box[2+shift] += delta
	}
	if ( box[2] > parent[2] )
		shFunc( parent[2] - box[2], true)
	if ( box[0] < parent[0] )
		shFunc( parent[0] - box[0], true)
	if ( box[3] > parent[3] )
		shFunc( parent[3] - box[3], false)
	if ( box[1] < parent[1] )
		shFunc( parent[1] - box[1], false)

	return box;
}
GUI.shiftToviewport = function( domElem ) {
	var el = GUI.DOMToObject( domElem );

	var vTop  = window.pageYOffset || document.documentElement.scrollTop + 2 ,
	    vLeft = window.pageXOffset || document.documentElement.scrollLeft + 2 ;
	var viewBox = [ vLeft, vTop, GUI.viewportWidth() + vLeft - 2, GUI.viewportHeight() + vTop -2 ]
	var left = el.offset().left, top = el.offset().top;
	var wndBox = [ left, top, left + el.outerWidth(true), top + el.outerHeight(true) ]
	var posBox = GUI.shiftBoxToParent( wndBox, viewBox )
	el.css( {left:posBox[0], top:posBox[1]} );
}
GUI.viewportWidth = function(){ return $("body").prop("clientWidth"); }
GUI.viewportHeight = function(){ return $("body").prop("clientHeight"); }
GUI.getScrollbarWidthHeight = function() {
	if( GUI.getScrollbarWidthHeight.result )
		return GUI.getScrollbarWidthHeight.result;
    var div = document.createElement("div");
    div.style.overflow = "scroll";
    div.style.visibility = "hidden";
    div.style.position = 'absolute';
    div.style.width = '100px';
    div.style.height = '100px';
    document.body.appendChild(div);

    GUI.getScrollbarWidthHeight.result = {
        width: div.offsetWidth - div.clientWidth,
        height: div.offsetHeight - div.clientHeight
    };
    div.parentNode.removeChild( div );
    return GUI.getScrollbarWidthHeight.result;
}
GUI.htmlEscape = function( txt ) { return $("<div />").text(txt).html() }
//You can pass to this function a DOM element, ID of DOM Element or jQuery object
//return always  jQuery object or document.body in case of incorrect input params 
GUI.DOMToObject = function ( in_v ) {
	var ret;
	if ( "string"===typeof(in_v) ) ret = $('#'+in_v );
	else if ( in_v instanceof jQuery ) ret = in_v;
	else if ( "object"===typeof(in_v) && in_v.nodeType  ) ret = $( in_v );
	else ret = document.body;

	return ret;
}
GUI.preloadImage = function (url) {
	try {
		var _img = new Image();
		_img.src = url;
	} catch (e) { }
};


/** @ignore */
GUI.log = function() { console.log.apply( console, arguments ); };
/** @ignore */
GUI.warn = function() { console.warn.apply( console, arguments ); };
/** @ignore */
GUI.error = function() { console.error.apply( console, arguments ); };
/** @ignore */
GUI.debug = function() { console.debug.apply( console, arguments ); };

/** @ignore */
(function($) {
	var defaults = {
		plugins: {
			// ICONS Font
			ElegantFont: {
				credits: "https://www.elegantthemes.com/blog/resources/elegant-icon-font",
				folder: 'elegant_font',
				js: [],
				css: ['style.min.css']
			},
			//jScrollPane recomended jQuery mouseweel and  mwheelIntent plugins for mousewheel support
			jQueryMousewheel: {
				credits: "https://github.com/jquery/jquery-mousewheel",
				folder: 'mousewheel',
				js: ['jquery.mousewheel.js', 'mwheelIntent.js'],
				css: []
			},
			// jScrollPane:{
			// 	credits:'http://jscrollpane.kelvinluck.com/',
			// 	folder: 'jScrollPane',
			// 	js:['jquery.jscrollpane.min.js'],
			// 	css:['jquery.jscrollpane.css'],
			// },
			// PrintArea: {
			// 	credits: 'http://jquery-print.ssdtutorials.com/',
			// 	folder: 'PrintArea',
			// 	js: ['PrintArea.min.js'],
			// 	css: []
			// },
			// AutoComplete: {
			// 	credits: 'https://github.com/devbridge/jQuery-Autocomplete',
			// 	folder: 'AutoComplete',
			// 	js: ['jquery.autocomplete.min.js'],
			// 	css: ['jquery.autocomplete.css']
			// },
			// JSZip: {
			// 	credits: 'https://github.com/Stuk/jszip',
			// 	folder: 'JSZip',
			// 	js: ['jszip.min.js'],
			// 	css: []
			// },
			// Pikaday: {
			// 	credits: 'https://github.com/dbushell/Pikaday http://momentjs.com/',
			// 	folder: 'Pikaday',
			// 	js: ['moment.js', 'pikaday.min.js'],
			// 	css: ['pikaday.min.css']
			// },
		}
	}
	var options = defaults;

	//include neccessary CSS and JS files into HTML HEAD section
	GUI.script_folder = null;
	GUI.script_node = null;
	var sp = document.getElementsByTagName('script');
	if (sp && sp.length > 0)
		for (var i in sp)
			if (sp[i].src && sp[i].src.match(new RegExp("gui/gui(?:\\.min)?\\.js"))) {
				GUI.script_folder = sp[i].src.substr(0, sp[i].src.lastIndexOf('/') + 1);
				GUI.script_node = $( sp[i] );
				break;
			}
	if (!GUI.script_folder) {
		GUI.error("Can't find script tag in HTML Head which referres to gui.js!");
		return;
	}
	var css_links = ['gui.css'];
	var js_links = [];
	for (var p in options.plugins) {
		var plugin = options.plugins[p];
		css_links = css_links.concat(plugin.css.map(function(i) { return plugin.folder + "/" + i; }));
		js_links = js_links.concat(plugin.js.map(function(i) { return plugin.folder + "/" + i; }));
		GUI.log('GUI. Loading plugin ' + p + '.', ' Credits: ' + plugin.credits);
	}

	css_links.forEach(function(a) {
		var link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = GUI.script_folder + a;
		//media="screen"
		link.media = "screen";
		document.getElementsByTagName("head")[0].appendChild(link);
		// GUI.script_node.after( link )
	});
	var deferreds = [];
	js_links.forEach(function(a) {
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = GUI.script_folder + a;
		script.async = false;
		// GUI.script_node.after( script )
		document.getElementsByTagName('head')[0].appendChild(script);

		// deferreds.push($.ajax({
		// 	url: GUI.script_folder + a,
		// 	dataType: "script",
		// 	async: true,
		// 	cache: true,
		// 	error: function() {
		// 		GUI.error("Error loading script " + a);
		// 	},
		// }));
	});
})(jQuery);
