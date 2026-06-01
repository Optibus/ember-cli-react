import Ember from 'ember';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { flushSync } from 'react-dom';
import YieldWrapper from './react-component/yield-wrapper';
import getMutableAttributes from 'ember-cli-react/utils/get-mutable-attributes';
import hasBlock from 'ember-cli-react/utils/has-block';
import lookupFactory from 'ember-cli-react/utils/lookup-factory';
import { shouldSyncMount } from 'ember-cli-react/utils/sync-mount';

const { get } = Ember;

const ReactComponent = Ember.Component.extend({
  _rootElem: null,

  /**
    The React component that this Ember component should wrap.
    @property reactComponent
    @type React.Component | Function | String
    @default null
   */
  reactComponent: Ember.computed.reads('_reactComponent'),

  getReactComponent() {
    const componentClassOrName = get(this, 'reactComponent');
    let componentClass;

    if (Ember.typeOf(componentClassOrName) === 'string') {
      componentClass = lookupFactory(
        this,
        `react-component:${componentClassOrName}`
      );

      // Set `displayName` so that it is visible in React devtools
      componentClass.displayName = Ember.String.classify(componentClassOrName);
    } else {
      componentClass = componentClassOrName;
    }

    if (!componentClass) {
      throw new Error(
        `Could not find react component : ${componentClassOrName}`
      );
    }

    return componentClass;
  },

  getProps() {
    return getMutableAttributes(get(this, 'attrs'));
  },

  getChildren(props) {
    // Determine the children
    // If there is already `children` in `props`, we just pass it down (it can be function).
    // Otherwise we need to wrap the current `childNodes` inside a React component.
    // It is important that `childNodes` are reconstructed with `[...childNodes]` because
    // it is a `NodeList`-type object instead of Array in the first place.
    // Without reconstructing, `childNodes` will include the React component itself when
    // `componentDidMount` hook is triggerred.
    let children = props.children;
    if (!children) {
      const childNodes = get(this, 'element.childNodes');

      // In Ember 2.8, an empty comment node is still created for non-block form
      // component. This behavior breaks any component that does not expect
      // children to exist.
      // We can safely assume that there is no child node if:
      // - The component is not in block form
      // - There is no child node (of course)

      // For other cases, we need to create a YieldWrapper to hold the nodes
      if (hasBlock(this) && childNodes.length > 0) {
        children = [
          React.createElement(YieldWrapper, {
            key: get(this, 'elementId'),
            nodes: [...childNodes],
          }),
        ];
      }
    }
    return children;
  },

  renderReact() {
    const componentClass = this.getReactComponent();
    const props = this.getProps();
    const children = this.getChildren(props);
    const component = React.createElement(componentClass, props, children);
    if (this._rootElem) {
      // _resolvedName is set by the resolver for template-resolved components
      // (e.g. {{my-react-comp}}); _reactComponent is set by positional
      // invocations (e.g. {{react-component "my-react-comp"}}). Either way,
      // we end up with the kebab-case container key as a string.
      const name = get(this, '_resolvedName') || get(this, '_reactComponent');
      if (typeof name === 'string' && shouldSyncMount(name)) {
        // Plain root.render() schedules the work on React 18's concurrent
        // scheduler, which yields between roots — so many sibling React
        // mounts produce a visible cascade of paints. flushSync forces this
        // root's render + commit to finish before returning, so when many
        // siblings opt in they all mount in the same task and the browser
        // paints once at the end.
        flushSync(() => this._rootElem.render(component));
      } else {
        this._rootElem.render(component);
      }
    }
  },

  didInsertElement() {
    this._rootElem = ReactDOM.createRoot(get(this, 'element'));
    this.renderReact();
  },

  didReceiveAttrs() {
    this.renderReact();
  },

  willDestroyElement() {
    if (this._rootElem) {
      this._rootElem.unmount();
    }
  },
});

ReactComponent.reopenClass({
  // Some versions of Ember override positional param value to undefined when
  // a subclass is created using `Ember.extend({ reactComponent: foo })` so
  // instead store this value in a separate property.
  positionalParams: ['_reactComponent'],
});

export default ReactComponent;
