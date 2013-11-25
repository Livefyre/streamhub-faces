define([
    'streamhub-sdk/jquery',
    'streamhub-sdk/content/views/content-list-view',
    'streamhub-sdk/content/views/content-view',
    'text!streamhub-wall/style.css',
    'inherits'
], function($, ContentListView, ContentView, MEDIA_WALL_CSS, inherits) {
    'use strict';

    var MEDIA_WALL_STYLE_EL;

    /**
     * A view that displays Content in a media wall.
     * @param opts {Object} A set of options to config the view with
     * @param opts.el {HTMLElement} The element in which to render the streamed content
     * @param opts.relayoutWait {number} The number of milliseconds to wait when debouncing
     *        .relayout(). Defaults to 200ms.
     * @param opts.css {boolean} Whether to insert default media wall css. Default true.
     * @constructor
     */
    var MediaWallView = function(opts) {
        var self = this;
        opts = opts || {};

        this._id = new Date().getTime();
        this._autoFitColumns = true;
        this._contentWidth = opts.minContentWidth || 300;
        this._columnViews = [];
        this._columnInsertIndex = 0;
        this._containerInnerWidth = 0;

        this.debouncedRelayout = debounce(function () {
            self._relayout.apply(self, arguments);
        }, opts.debounceRelayout || 200);

        this.debouncedFitColumns = debounce(function () {
            self._fitColumns();
        }, opts.debounceRelayout || 200);

        ContentListView.call(this, opts);
 
        $(window).resize(function() {
            if (self._autoFitColumns) {
                self.fitColumns();
            }
        });

        opts.css = (typeof opts.css === 'undefined') ? true : opts.css;
        if (!MEDIA_WALL_STYLE_EL && opts.css) {
            MEDIA_WALL_STYLE_EL = $('<style></style>').text(MEDIA_WALL_CSS).prependTo('head');
        }
        if (opts.columns && typeof opts.columns === 'number') {
            this._autoFitColumns = false;
            this.setColumns(opts.columns);
        }
        if (this._autoFitColumns) {
            this.fitColumns({ force: true });
        }
    };
    inherits(MediaWallView, ContentListView);


    MediaWallView.prototype.mediaWallClassName = 'streamhub-media-wall-view';
    MediaWallView.prototype.columnClassName = 'hub-wall-column';

    /**
     * Gets the style element associated with this instance of MediaWallView
     * @returns {HTMLElement} The style element for this MediaWallView
     */
    MediaWallView.prototype._getWallStyleEl = function () {
        var $wallStyleEl = $('#wall-style-' + this._id);
        if ($wallStyleEl) {
            return $wallStyleEl;
        }
    };

    /**
     * Sets the column width in the style element for this MediaWallView
     * instance.
     * @returns {Number} The width of the column in pixels
     */
    MediaWallView.prototype._setColumnWidth = function (width) {
        var $wallStyleEl = this._getWallStyleEl();
        if ($wallStyleEl) {
            $wallStyleEl.remove();
        }
        $wallStyleEl = $('<style id="wall-style-' + this._id + '"></style');
        $wallStyleEl.html('.streamhub-media-wall-'+this._id+' .hub-wall-column { width: ' + width + '; }');
        $wallStyleEl.appendTo('head');

        return this._getColumnWidth();
    };

    /**
     * Gets the column width
     * @returns {Number} The width of the column in pixels
     */
    MediaWallView.prototype._getColumnWidth = function () {
        var $contentContainerEl = this.$el.find('.'+this.columnClassName);
        if ($contentContainerEl.length) {
            this._columnWidth = $contentContainerEl[0].getBoundingClientRect().width;
            return this._columnWidth;
        }
        return 0;
    };

    /**
     * Set the element that this ContentListView renders in
     * @param element {HTMLElement} The element to render the ContentListView in
     */
    MediaWallView.prototype.setElement = function (el) {
        ContentListView.prototype.setElement.call(this, el);
        this.$el
            .addClass(this.mediaWallClassName)
            .addClass('streamhub-media-wall-' + this._id);
    };

    MediaWallView.prototype.fitColumns = function (opts) {
        if (this._containerInnerWidth == this.$el.innerWidth()) {
            return;
        }
        opts = opts || {};

        if (opts.force) {
            this._fitColumns.apply(this, arguments);
        } else {
            this.debouncedFitColumns.apply(this, arguments);
        }
    };

    /**
     * Determines the number columns based on the configured #_contentWidth.
     * Initiates relayout logic for the determined number of columns.
     * @param opts {Object}
     */
    MediaWallView.prototype._fitColumns = function (opts) {
        this._containerInnerWidth = $(this.el).innerWidth();
        var numColumns = parseInt(this._containerInnerWidth / this._contentWidth, 10) || 1;
        this._clearColumns();
        this.setColumns(numColumns);
    };

    /**
     * Creates a column view for the number of columns specified. Triggers
     * relayout.
     * @param numColumns {Number} The number of columns the MediaWallView should be composed of
     */
    MediaWallView.prototype.setColumns = function (numColumns) {
        this._numberOfColumns = numColumns;
        var $wallStyleEl = this._getWallStyleEl();
        if ($wallStyleEl) {
            $wallStyleEl.remove();
        }
        $wallStyleEl = $('<style id="wall-style-' + this._id + '"></style');
        this._setColumnWidth((100/this._numberOfColumns) + '%');

        for (var i=0; i < this._numberOfColumns; i++) {
            this._createColumnView();
        }

        this._moreAmount = this._moreAmount || numColumns * 2; // Show more displays 2 new rows

        this.relayout();
    };

    /**
     * Gets the number of maximum visible items for a given column view
     * @returns {Number} The number of maximum visible items for a given column view
     */
    MediaWallView.prototype._getMaxVisibleItemsForColumn = function () {
        return this._maxVisibleItems/this._numberOfColumns;
    };

    /**
     * Creates a column view and appends it into the DOM
     * @returns {View} The view representing a column in the MediaWall. Often a type of ListView.
     */
    MediaWallView.prototype._createColumnView = function () {
        var columnView = new ContentListView({
            maxVisibleItems: this._getMaxVisibleItemsForColumn(),
            stash: this.more
        });
        this._columnViews.push(columnView);
        columnView.$el.addClass(this.columnClassName);
        this.$listEl.append(columnView.$el);
        return columnView;
    };

    /**
     * Removes column views from the MediaWallView
     */
    MediaWallView.prototype._clearColumns = function () {
        var contentViews = [];
        for (var i=0; i < this._columnViews.length; i++) {
            var columnView = this._columnViews[i];
            contentViews = contentViews.concat(columnView.views);
            columnView.destroy();
        }
        this.views = contentViews;
        if (this.comparator) {
            this.views.sort(this.comparator);
        }
        this._columnViews = [];
    };

    /**
     * Add a piece of Content to the MediaWallView
     * @param content {Content} A Content model to add to the MediaWallView
     * @return the newly created ContentView
     */
    MediaWallView.prototype.add = function(content) {
        var contentView = ContentListView.prototype.add.call(this, content);

        var targetColumnView = this._columnViews[this._columnInsertIndex];
        this._columnInsertIndex++;
        this._columnInsertIndex = this._columnInsertIndex == this._columnViews.length ? 0 : this._columnInsertIndex;
        targetColumnView.add(contentView);
    };

    MediaWallView.prototype._insert = function (contentView) {
        return; // no-op: contentView inserts are deferred to individual Column views
    };
    
    /**
     * Remove a View from this MediaWallView
     * @param content {Content|ContentView} The ContentView or Content to be removed
     * @returns {boolean} true if Content was removed, else false
     */
    MediaWallView.prototype.remove = function (content) {
        var retVal;
        for (var i=0; i < this._columnViews.length; i++) {
            var contentView = this._columnViews[i].getContentView(content);
            if (contentView) {
                retVal = this._columnViews[i].remove(contentView);
                return retVal;
            }
        }
        return retVal;
    };

    MediaWallView.prototype.relayout = function (opts) {
        opts = opts || {};
        if (opts.force) {
            this._relayout.apply(this, arguments);
        } else {
            this.debouncedRelayout.apply(this, arguments);
        }
    };

    /**
     * Re-renders all content views for the MediaWallView.
     */
    MediaWallView.prototype._relayout = function(opts) {
        this.columnBasedLayout();
    };

    /**
     * The column-based round-robin strategy of laying out content views
     */
    MediaWallView.prototype.columnBasedLayout = function () {
        // Round-robin through columns, prepending each column with the next
        // available view
        this._columnInsertIndex = 0;
        for (var i=this.views.length-1; i >= 0; i--) {
            var contentView = this.views[i];
            this.add(contentView.content);
        }
    };

    /**
     * Show More content.
     * ContentListView keeps track of an internal ._newContentGoal
     *     which is how many more items he wishes he had.
     *     This increases that goal and marks the Writable
     *     side of ContentListView as ready for more writes.
     * @param numToShow {number} The number of items to try to add
     */
    MediaWallView.prototype.showMore = function (numToShow) {
        // When fetching more content from the archive, remove the bounded
        // visible limit
        for (var i=0; i < this._columnViews.length; i++) {
            this._columnViews[i].bounded(false);
        }
        ContentListView.prototype.showMore.call(this, numToShow);
    };

    /**
     * Returns a function, that, as long as it continues to be invoked, will not be triggered.
     * The function will be called after it stops being called for N milliseconds.
     * Copied from Underscore.js (MIT License) http://underscorejs.org/docs/underscore.html#section-65
     * @param func {function} The function to debounce
     * @param wait {number} The number of milliseconds to wait for execution of func
     * @param immediate {boolean} trigger the function on the leading edge, instead of the trailing.
     * @return {function} A debounced version of the passed `func`
     */
    function debounce(func, wait, immediate) {
        var timeout, result;
        return function() {
            var context = this,
                args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) {
                    result = func.apply(context, args);
                }
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) {
                result = func.apply(context, args);
            }
            return result;
        };
    }

    MediaWallView.prototype.destroy = function () {
        ContentListView.prototype.destroy.call(this);
        this._columnViews = null;
    };

    return MediaWallView;
});
