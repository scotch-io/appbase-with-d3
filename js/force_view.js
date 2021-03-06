// http://bl.ocks.org/benzguo/4370043
define(['d3', 'jquery', 'pubsub'], function(d3, $, PubSub) {
  var width = 960,
      height = 500,
      fill = d3.scale.category20(),
      outer,
      vis,
      force,
      drag_line,
      // layout properties
      nodes,
      links,
      node,
      link,
      text,
      // mouse event vars
      selected_node,
      selected_link,
      mousedown_link,
      mousedown_node,
      mouseup_node;

  function init(namespace) {
    // init svg
    outer = d3.select("#chart")
      .append("svg:svg")
      .attr("width", width)
      .attr("height", height)
      .attr("pointer-events", "all");
    vis = outer
      .append('svg:g')
      .call(d3.behavior.zoom().on("zoom", rescale))
      .on("dblclick.zoom", null)
      .append('svg:g')
      .on("mousemove", mousemove)
      .on("mousedown", mousedown)
      .on("mouseup", mouseup);
    vis.append('svg:rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'white');

    // init force layout
    force = d3.layout.force()
      .size([width, height])
      .nodes([])
      .linkDistance(50)
      .charge(-200)
      .on("tick", tick);

    // line displayed when dragging new nodes
    drag_line = vis.append("line")
      .attr("class", "drag_line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 0);

    // get layout properties
    nodes = force.nodes();
    links = force.links();
    node = vis.selectAll(".node");
    link = vis.selectAll(".link");
    text = vis.selectAll(".text");

    // add keyboard callback
    d3.select(window).on("keydown", keydown);

    redraw();
    require(['appbaseSync'], function(AppbaseSync) {
      AppbaseSync.init(namespace);
    });
  }

  // focus on svg
  // vis.node().focus();

  function mousedown() {
    if (!mousedown_node && !mousedown_link) {
      // allow panning if nothing is selected
      vis.call(d3.behavior.zoom().on("zoom"), rescale);
      return;
    }
  }

  function mousemove() {
    if (!mousedown_node) return;

    // update drag line
    drag_line
        .attr("x1", mousedown_node.x)
        .attr("y1", mousedown_node.y)
        .attr("x2", d3.svg.mouse(this)[0])
        .attr("y2", d3.svg.mouse(this)[1]);

  }

  function mouseup() {
    if (mousedown_node) {
      // hide drag line
      drag_line
        .attr("class", "drag_line_hidden")

      if (!mouseup_node) {
        // add node
        var point = d3.mouse(this),
            node = {x: point[0], y: point[1]},
            n = nodes.push(node),
            link = {source: mousedown_node, target: node};

        // select new node
        selected_node = node;
        selected_link = null;

        // add link to mousedown node
        links.push(link);
        PubSub.publish('forceView:addedNode', node);
        PubSub.publish('forceView:addedLink', link);
      }

      redraw();
    }
    // clear mouse event vars
    resetMouseVars();
  }

  function resetMouseVars() {
    mousedown_node = null;
    mouseup_node = null;
    mousedown_link = null;
  }

  function tick() {
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node.attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });

    text.attr("dx", function(d) { return 10 + d.x; })
        .attr("dy", function(d) { return d.y; })
        .attr("fill", function(d) { return d.color ? d.color : 'black'; })
        .text(function(d){return d.label});
  }

  // rescale g
  function rescale() {
    trans=d3.event.translate;
    scale=d3.event.scale;

    vis.attr("transform",
        "translate(" + trans + ")"
        + " scale(" + scale + ")");
  }

  // redraw force layout
  function redraw() {

    link = link.data(links);

    link.enter().insert("line", ".node")
        .attr("class", "link")
        .on("mousedown", 
          function(d) { 
            mousedown_link = d; 
            if (mousedown_link == selected_link) selected_link = null;
            else selected_link = mousedown_link; 
            selected_node = null; 
            redraw(); 
          })

    link.exit().remove();

    link
      .classed("link_selected", function(d) { return d === selected_link; });

    node = node.data(nodes);

    node.enter().insert("circle")
        .attr("class", "node")
        .attr("r", 5)
        .on("mousedown", 
          function(d) { 
            // disable zoom
            vis.call(d3.behavior.zoom().on("zoom"), null);

            mousedown_node = d;
            if (mousedown_node == selected_node) selected_node = null;
            else selected_node = mousedown_node; 
            selected_link = null; 

            // reposition drag line
            drag_line
                .attr("class", "link")
                .attr("x1", mousedown_node.x)
                .attr("y1", mousedown_node.y)
                .attr("x2", mousedown_node.x)
                .attr("y2", mousedown_node.y);

            redraw(); 
          })
        .on("mousedrag",
          function(d) {
            // redraw();
          })
        .on("dblclick", function(d) {
            PubSub.publish('forceView:editedNode', d);
          })
        .on("mouseup", 
          function(d) { 
            if (mousedown_node) {
              mouseup_node = d; 
              if (mouseup_node == mousedown_node) { resetMouseVars(); return; }

              // add link
              var link = {source: mousedown_node, target: mouseup_node};
              links.push(link);
              PubSub.publish('forceView:addedLink', link);

              // select new link
              selected_link = link;
              selected_node = null;

              // enable zoom
              vis.call(d3.behavior.zoom().on("zoom"), rescale);
              redraw();
            } 
          })
      .transition()
        .duration(750)
        .ease("elastic")
        .attr("r", 6.5);

    node.exit().transition()
        .attr("r", 0)
        .remove();

    node
      .classed("node_selected", function(d) { return d === selected_node; });


    text = text.data(nodes);
    text.enter().insert("text").attr("class", "text");
    text.exit().remove();


    if (d3.event) {
      // prevent browser's default behavior
      d3.event.preventDefault();
    }

    force.start();

  }

  function spliceLinksForNode(node) {
    var toSplice = links.filter( function(l) { 
      return (l.source === node) || (l.target === node);
    });
    toSplice.map( function(l) {
      links.splice(links.indexOf(l), 1);
    });
  }

  function keydown() {
    if (!selected_node && !selected_link) return;
    switch (d3.event.keyCode) {
      case 8: // backspace
      case 46: { // delete
        if (selected_node) {
          nodes.splice(nodes.indexOf(selected_node), 1);
          spliceLinksForNode(selected_node);
          PubSub.publish('forceView:deletedNode', selected_node);
        }
        else if (selected_link) {
          links.splice(links.indexOf(selected_link), 1);
          PubSub.publish('forceView:deletedLink', selected_link);
        }
        selected_link = null;
        selected_node = null;
        redraw();
        break;
      }
    }
  }

  function searchNode(node) {
    return nodes.filter( function(n) {
      return !!(node && node.id == n.id);
    })[0];
  };
 
  function searchLink(link) {
    if (link.source && link.target) {
      return links.filter( function(l) {
        return (l.source === link.source) && (l.target === link.target);
      })[0];
    } else if (link.id) {
      return links.filter( function(l) {
        return link.id === l.id;
      })[0];
    } else {
      return undefined;
    }
  };

  PubSub.subscribe('forceView:clear', function(msg, callback) {
    while (nodes.pop());
    while (links.pop());
    redraw();
    callback && callback();
  });
  PubSub.subscribe('forceView:deleteNode', function(msg, node) {
    var selected_node = searchNode(node);
    if (selected_node) {
      nodes.splice(nodes.indexOf(selected_node), 1);
      spliceLinksForNode(selected_node);
      redraw();
    }
  });
  PubSub.subscribe('forceView:deleteLink', function(msg, link) {
    var source, target, selected_link;
    source = searchNode(link.source);
    target = searchNode(link.target);
    selected_link = searchLink({source: source, target: target, id: link.id});
    if (selected_link) {
      links.splice(links.indexOf(selected_link), 1);
      redraw();
    }
  });
  PubSub.subscribe('forceView:addNode', function(msg, node) {
    var selected_node = searchNode(node);
    if (!selected_node) {
      nodes.push(node);
      redraw();
    }
  });
  PubSub.subscribe('forceView:addLink', function(msg, link) {
    var source, target, selected_link;
    link = link || {};
    source = searchNode(link.source);
    target = searchNode(link.target);
    selected_link = searchLink({source: source, target: target});
    if (source && target && !selected_link) {
      links.push({source:source, target:target, id: link.id});
      redraw();
    }
  });
  PubSub.subscribe('forceView:editNode', function(msg, node) {
    var selected_node = searchNode(node);
    if (selected_node) {
      $.extend(selected_node, node);
      redraw();
    }
  });

  return {
    init: init,
    redraw: redraw
  };
});
