/*jslint node: true */
/*jshint laxbreak: true */
"use strict" ;

var d3 = require("d3");
var _ = require("underscore");
var TooltipFactory = require("./TooltipFactory");
var FeatureFactory = require("./FeatureFactory");

var ViewerHelper = function() {
    var mousedownXY = {x: -1, y: -1}, mouseupXY = {x: -2, y: -2};
    return {
        createSVG: function(container, width, height, fv, clazz) {
            var svg = container
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .on('mousedown', function() {
                    mousedownXY = {x: d3.event.pageX, y: d3.event.pageY};
                    mouseupXY = {x: -2, y: -2};
                })
                .on('mouseup', function() {
                    mouseupXY = {x: d3.event.pageX, y: d3.event.pageY};
                    if ((mousedownXY.x === mouseupXY.x) && (mousedownXY.y === mouseupXY.y)
                        && !fv.overFeature && fv.selectedFeature ) {
                        ViewerHelper.selectFeature(fv.selectedFeature, fv.selectedFeatureElement, fv);
                    }
                    mousedownXY = {x: -1, y: -1};
                })
                .call(fv.zoom);

            if (clazz) {
                svg.attr('class', clazz);
            }
            svg.append('g').append('path')
                .classed('up_pftv_highlight', true)
                .attr('d', 'M-1,-1')
                .attr('transform', 'translate(-1,-1)')
                .attr('height', height);

            return svg;
        }
    };
}();

ViewerHelper.highlightPath = function (feature, fv, height) {
    var aaWidth = fv.xScale(2) - fv.xScale(1);
    var gapRegion = aaWidth/2;
    var width = aaWidth * (feature.end ? feature.end - feature.begin + 1 : 1);
    var path;
    if (!feature.type) {
        path = 'M-1,-1';
    } else if (FeatureFactory.isContinuous(feature.type)) {
        path = 'M' + -(gapRegion) + ',0'
            + 'L' + (-gapRegion+width) + ',0'
            + 'L' + (-gapRegion+width) + ',' + height
            + 'L' + -(gapRegion) + ',' + height
            + 'Z';
    } else {
        path = 'M' + -(gapRegion) + ',0'
            + 'L' + (-gapRegion+width) + ',0'
            + 'L' + (-gapRegion+width) + ',' + height
            + 'L' + (-gapRegion+width-aaWidth) + ',' + height
            + 'L' + (-gapRegion+width-aaWidth) + ',0'
            + 'L' + (-gapRegion+aaWidth) + ',0'
            + 'L' + (-gapRegion+aaWidth) + ',' + height
            + 'L' + (-gapRegion) + ',' + height
            + 'Z';
    }
    return path;
};

ViewerHelper.updateHighlight = function(fv) {
    var feature;
    if (fv.selectedFeature) {
        feature = fv.selectedFeature;
    } else if (fv.highlight) {
        feature = fv.highlight;
    } else {
        return;
    }

    var xTranslate = fv.xScale(feature.begin);
    fv.globalContainer.selectAll('.up_pftv_highlight')
        .attr('d', function() {
            var height = d3.select(this).attr('height');
            return ViewerHelper.highlightPath(feature, fv, height);
        })
        .attr('transform', 'translate(' + xTranslate + ',0)');
    if (fv.highlight) {
        fv.updateHighlightSelector();
    }
};

ViewerHelper.resetHighlight = function(fv) {
        fv.highlight = undefined;
        fv.globalContainer.selectAll('.up_pftv_highlight')
            .attr('d', 'M-1,-1')
            .attr('transform', 'translate(-1,-1)');
        fv.updateHighlightSelector();
};

ViewerHelper.selectFeature = function(feature, elem, fv) {
    fv.highlight = undefined;
    var selectedElem = d3.select(elem);
    var previousSelection = {feature: fv.selectedFeature, elem: fv.selectedFeatureElement};
    if (feature === fv.selectedFeature) {
        fv.selectedFeature = undefined;
        fv.selectedFeatureElement = undefined;
        this.resetHighlight(fv);
    } else {
        fv.selectedFeature = feature;
        fv.selectedFeatureElement = elem;
        this.updateHighlight(fv);
    }
    var selectedPath = selectedElem.classed('up_pftv_activeFeature');
    fv.globalContainer.selectAll('svg path.up_pftv_activeFeature').classed('up_pftv_activeFeature', false);
    //it is not active anymore
    selectedElem.classed('up_pftv_activeFeature', !selectedPath);
    fv.updateFeatureSelector();
    if (previousSelection.feature) {
        fv.dispatcher.featureDeselected(
            {feature: previousSelection.feature, color: d3.select(previousSelection.elem).style("fill")}
        );
    }
    if (feature !== previousSelection.feature) {
        if (previousSelection.elem) {
            d3.select(previousSelection.elem).classed('up_pftv_activeFeature', false);
        }
        fv.dispatcher.featureSelected({feature: fv.selectedFeature, color: selectedElem.style("fill")});
    }
};

ViewerHelper.addEventsClassAndTitle = function(catTitle, elements, fv, container) {
    elements
        .classed('up_pftv_activeFeature', function(d) {
            return d === fv.selectedFeature;
        })
        .on('click', function(d){
            var elem = d3.select(this);
            if (!elem.classed('up_pftv_variant_hidden')) {
                if (!elem.classed('up_pftv_activeFeature')) {
                    TooltipFactory.createTooltip(fv, catTitle, d, container);
                } else {
                    var tooltipContainer = fv.globalContainer.selectAll('.up_pftv_tooltip-container')
                        .transition(20)
                        .style('opacity', 0)
                        .style('display', 'none');
                    tooltipContainer.remove();
                }
                ViewerHelper.selectFeature(d, this, fv);
            }
        })
        .on('mouseover', function(d) {
            fv.overFeature = true;
            if (d3.select(this).classed('up_pftv_variant')) {
                var initial = d.alternativeSequence.charAt(0);
                fv.globalContainer.selectAll('g.up_pftv_aa_' + initial + ' line').style('opacity', 1);
            }
        })
        .on('mouseout', function(d) {
            fv.overFeature = false;
            if (d3.select(this).classed('up_pftv_variant')) {
                var initial = d.alternativeSequence.charAt(0);
                fv.globalContainer.selectAll('g.up_pftv_aa_' + initial + ' line').style('opacity', 0.4);
            }
        });
};

module.exports = ViewerHelper;
