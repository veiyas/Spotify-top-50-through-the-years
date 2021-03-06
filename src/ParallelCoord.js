import {
  extent,
  scaleLinear,
  scalePoint,
  select,
  axisLeft,
  line,
  brushY,
  drag,
} from 'd3';
import { paramFullNames, hundredRange } from './paramInfo';
import RadarPlot from './RadarPlot';

/* Some links that might be useful
     - https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.258.5174&rep=rep1&type=pdf
       combinations...
     - https://core.ac.uk/download/pdf/192069397.pdf -- Mostly 3d pc
     - https://www.napier.ac.uk/~/media/worktribe/output-267438/using-curves-to-enhance-parallel-coordinate-visualisations.pdf
*/

/** Width of the brush selections */
const BRUSH_WIDTH = 35;

// Inspired by https://www.d3-graph-gallery.com/graph/parallel_basic.html
export default class ParallelCoord {
  /** `propsToUse` is a Set */
  constructor(data, divId, propsToUse) {
    this.data = data;
    this.div = document.getElementById(divId);
    this.propsToUse = propsToUse;

    this.radarPlot = new RadarPlot();
    this.radarPlotExists = false;

    // Calculate width, height, etc.
    const containerWidth = this.div.clientWidth;
    const containerHeight = this.div.clientHeight;
    this.margin = { top: 31, right: 60, bottom: 10, left: 40 };
    /** Width excluding margins */
    this.width = containerWidth - this.margin.left - this.margin.right;
    /** Height excluding margins */
    this.height = containerHeight - this.margin.top - this.margin.bottom;

    // Put plot svg to this.div
    this.div.innerHTML = '';
    this.svg = select(this.div)
      .append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom);

    // Create a group in svg for the actual plot space
    this.plot = this.svg
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Group on top of this.plot to make the axes and brushes on top at all times
    this.plotAxesGroup = this.svg
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.tooltip = select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);

    // The name of the dimensions(/axes) to use for plotting
    this.dimensions = Object.keys(this.data[0]).filter((key) =>
      this.propsToUse.has(key)
    );

    this.yScales = {};
    for (const dim of this.dimensions) {
      this.yScales[dim] = scaleLinear()
        .domain(
          // Show full [0,100] for applicable parameters
          hundredRange.has(dim) ? [0, 100] : extent(this.data, (d) => +d[dim])
        )
        .range([this.height, 0])
        .nice();
    }

    this.xScale = scalePoint().range([0, this.width]).domain(this.dimensions);

    this.axes = new Map(
      // Reduce the number of ticks on the scale to reduce clutter
      this.dimensions.map((d) => [d, axisLeft(this.yScales[d]).ticks(2)])
    );

    this.pathGen = (d) =>
      line()(
        this.dimensions.map((p) => [this.xPosition(p), this.yScales[p](d[p])])
      );

    // Brush
    this.selections = new Map();
    const outerThis = this; // For access to this in callback where this is rebound
    this.brush = brushY()
      .extent([
        [-(BRUSH_WIDTH / 2), 0],
        [BRUSH_WIDTH / 2, this.height],
      ])
      .on('start brush end', ({ selection, sourceEvent }, key) => {
        // Inspired by https://observablehq.com/@d3/brushable-parallel-coordinates?collection=@d3/d3-brush
        if (selection === null) this.selections.delete(key);
        else this.selections.set(key, selection.map(this.yScales[key].invert));

        this.allLinesSelection.each(function (d) {
          const lineIsActive = outerThis.isInBrushRange(d);
          select(this)
            .classed('inactive', !lineIsActive)
            .classed('active', lineIsActive)
            // Make sure hover state is removed if line gets hidden while hovered
            .classed('hover', false);
          if (lineIsActive) {
            select(this).raise();
          }
        });
        this.songList.each(function (d) {
          select(this).style(
            'display',
            outerThis.isInBrushRange(d) ? undefined : 'none'
          );
        });
      });
    // Clear brushes from button
    select('#clear-pc').on('click', (event, d) => {
      this.selections.clear(); // Clear filters
      this.brushesSelection.call(this.brush.move, null); // Reset brushes
      this.drawLines(); // Redraw with no filter
      this.drawSongList();
    });

    // Axis reordering stuff
    this.draggedAxes = new Map();

    // Draw legend
    // TODO Or rather don't for now, but we prbobaly should
    // const
    // const legend = select('#pc-legend')
    //   .selectAll('li')
    //   .data()
    //   .enter()
    //   .append('li');
    // legend
    //   .append('span')
    //   .attr('class', 'color-dot')
    //   .style('background-color', (d) => colors(d.id));
    // legend.append('span').text((d) => paramFullNames.get(d.id));

    this.updateYearDisplay();
    this.drawLines();
    this.drawAxes();
    this.drawSongList();
  }

  drawAxes() {
    const axesSelection = this.plotAxesGroup
      .selectAll('.dimension')
      .data(this.dimensions)
      .enter()
      .append('g')
      .attr('class', 'dimension');

    // Add axis labels
    axesSelection
      .append('text')
      .style('text-anchor', 'middle')
      .attr('y', -15)
      .text((d) => paramFullNames.get(d))
      .attr('class', 'axis-label')
      .on('mouseover', function (event, d) {
        select(this).text(`< ${paramFullNames.get(d)} >`);
      })
      .on('mouseout', function (event, d) {
        select(this).text(`${paramFullNames.get(d)}`);
      });

    // Add axis reordering functionality
    axesSelection.call(
      // Inspired by https://bl.ocks.org/jasondavies/1341281
      drag()
        .filter(({ target }) => target.classList.contains('axis-label'))
        .on('start', (event, d) => {
          this.draggedAxes.set(d, this.xScale(d));
        })
        .on('drag', (event, d) => {
          this.draggedAxes.set(d, Math.min(this.width, Math.max(0, event.x)));
          this.allLinesSelection.attr('d', this.pathGen);
          this.dimensions.sort((a, b) => this.xPosition(a) - this.xPosition(b));
          this.xScale.domain(this.dimensions);
          axesSelection.attr(
            'transform',
            (d) => `translate(${this.xPosition(d)})`
          );
        })
        .on('end', (event, d) => {
          this.draggedAxes.delete(d);
          axesSelection
            .transition()
            .attr('transform', (d) => `translate(${this.xPosition(d)})`);
          this.allLinesSelection.transition().attr('d', this.pathGen);
        })
    );

    // Add axes
    axesSelection
      .attr('transform', (d) => `translate(${this.xScale(d)})`)
      .each((d, i, nodes) => {
        select(nodes[i]).transition().call(this.axes.get(d));
      });

    // Add brush to axes
    this.brushesSelection = axesSelection.append('g').call(this.brush);
  }

  drawLines() {
    const lines = this.plot.selectAll('.line').data(this.data);
    lines.exit().remove();
    this.allLinesSelection = lines.enter().append('path').merge(lines);

    this.allLinesSelection
      // .transition() // Not sure if this is the transition is just confusing
      .attr('d', this.pathGen)
      .attr('class', 'line')
      .attr('id', (d) => `pc-line-id-${d['']}`)
      .classed('inactive', (d) => !this.isInBrushRange(d))
      .classed('active', (d) => this.isInBrushRange(d))
      .style('stroke', (d) => (d['cluster'] === 0 ? '#FF5100' : undefined));

    this.allLinesSelection
      .on('mouseover', (event, d) => {
        this.tooltip.transition().duration(40).style('opacity', 1);
        this.tooltip
          .html(d.title + '<br/>by ' + d.artist)
          .style('left', event.pageX + 'px')
          .style('top', event.pageY - 28 + 'px');

        select(event.target).raise().classed('hover', true);
      })
      .on('mouseout', (event, d) => {
        this.tooltip.transition().style('opacity', 0);
        select(event.target).classed('hover', false);
      });

    this.allLinesSelection.on('click', (event, d) => {
      if (this.radarPlotExists) {
        this.radarPlot.setData(d);
      } else {
        this.radarPlot = new RadarPlot(d);
        this.radarPlotExists = true;
      }
    });
  }

  updateYearDisplay() {
    const [min, max] = extent(this.data, (d) => +d.year);
    const startYear = new Date(min);
    if (min === max) {
      select('#year-disp-pc').text('Year ' + startYear.getFullYear());
    } else {
      const endYear = new Date(max);
      select('#year-disp-pc').text(
        `Years ${startYear.getFullYear()}–${endYear.getFullYear()}`
      );
    }
  }

  drawSongList() {
    this.songList = select('#song-list-body')
      .selectAll('tr')
      .data(this.data)
      .join('tr')
      .html((d) => `<td>${d.title}</td><td>${d.artist}</td>`)
      .style('display', (d) => (this.isInBrushRange(d) ? undefined : 'none'))
      .attr('id', (d) => `list-id-${d['']}`)
      .on('mouseover', function (event, d) {
        const id = this.id.slice(8);
        select(`#pc-line-id-${id}`).classed('hover', true).raise();
      })
      .on('mouseout', function (event, d) {
        const id = this.id.slice(8);
        select(`#pc-line-id-${id}`).classed('hover', false);
      })
      .on('click', (event, d) => {
        if (this.radarPlotExists) {
          this.radarPlot.setData(d);
        } else {
          this.radarPlot = new RadarPlot(d);
          this.radarPlotExists = true;
        }
      });
  }

  isInBrushRange(d) {
    return Array.from(this.selections).every(
      ([key, [max, min]]) => d[key] >= min && d[key] <= max
    );
  }

  /** Returns the xPosition taking dragging into account */
  xPosition(d) {
    const draggedPos = this.draggedAxes.get(d);
    return draggedPos ? draggedPos : this.xScale(d);
  }

  /** Data should have the same dimensions as the initial data.
   *  To make comparisons easier the axes are not updated, thus new
   *  data must have the same or smaller extent than the initial data
   */
  setData(newData) {
    this.data = newData;
    this.updateYearDisplay();
    this.drawLines();
    this.drawSongList();
  }
}
