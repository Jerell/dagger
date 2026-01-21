import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { EyeIcon } from "lucide-react";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <div className="flex-1 min-h-0 w-full flex flex-col bg-brand-white border border-brand-grey-3 overflow-y-auto">
      <section className="flex flex-col items-center justify-center border-b pb-2 border-brand-grey-3 p-2">
        <h2 className="text-2xl font-bold">Dagger</h2>
        <p>A tool for creating and managing DAGs.</p>
        <div className="border border-brand-grey-3 p-1 grid grid-cols-3 gap-1 [&>a]:w-full [&>a>button]:w-full">
          <Link to="/network/watch">
            <Button aria-label="Watch">
              <EyeIcon /> Watch
            </Button>
          </Link>
          <Link to="/network/$networkId" params={{ networkId: "preset1" }}>
            <Button aria-label="Preset 1">Preset 1</Button>
          </Link>
          <Link
            to="/network/$networkId"
            params={{ networkId: "preset1" }}
            disabled
          >
            <Button aria-label="Preset 1" disabled>
              Preset 2
            </Button>
          </Link>
        </div>
      </section>
      <section className="flex flex-col justify-center border-b border-brand-grey-3 p-2">
        <h2 className="text-2xl font-bold">Directed Acyclic Graphs</h2>
        <p>
          A directed acyclic graph (DAG) is a graph that has no cycles. It is a
          set of nodes with directed edges connecting them. DAGs can be used to
          model and analyze network structures like flow networks.
        </p>
        <p>
          A fluid flow can be broken into segments, each having a linear
          sequence of components. In <span className="italic">Dagger</span>, the
          segments are called <span className="font-bold">branches</span> and
          the components are called <span className="font-bold">blocks</span>.
        </p>
      </section>
      <section className="flex flex-col justify-center border-b border-brand-grey-3 p-2">
        <h2 className="text-2xl font-bold">
          Data files and variable scope resolution
        </h2>
        <p>
          The network is defined in a flat set of toml files. The file names are
          used as IDs for nodes in the graph.
        </p>
        <p>
          There are four scope levels in <span className="italic">Dagger</span>.
          These can be used to set default values for properties.
        </p>
        <div className="pl-2">
          <h3 className="text-lg font-bold">Global</h3>
          <p>
            Global scope is the highest level. Global properties are defined in
            the <code className="text-brand-grey-3">config.toml</code> file.
          </p>

          <h3 className="text-lg font-bold">Group</h3>
          <p>
            Groups are a level above branches. Any branch can be a member of any
            one group. Group membership is defined in the branch file like this:{" "}
            <code className="text-brand-grey-3">parentId = "group-1"</code>. A
            group can be used to set properties that are common to all branches
            in the group. In the visual editor, groups appear as containers that
            visually organize their child branches. The position of child
            branches is relative to the group.
          </p>

          <h3 className="text-lg font-bold">Branch</h3>
          <p>
            Branches are the linear segments of the network. They are defined in
            their own toml files.
          </p>
          <p>
            A branch may connect to zero, one, or many other branches. These
            connections form the edges of the directed graph. Connections are
            specified in the branch file like this:
          </p>
          <div className="flex flex-col bg-brand-grey-1 p-1 text-brand-blue-4">
            <code>[[outgoing]]</code>
            <code>target = "branch-2"</code>
            <code>weight = 1</code>
          </div>
          <p>
            The weight is used to determine the flow ratio into the destination
            branch. In the visual editor, you can create these connections by
            dragging from one branch node to another.
          </p>

          <h3 className="text-lg font-bold">Block</h3>
          <p>
            Blocks are the components of the network. They are defined in the
            branch file like this:{" "}
          </p>
          <div className="flex flex-col bg-brand-grey-1 p-1 text-brand-blue-4">
            <code>[[block]]</code>
            <code>type = "Compressor"</code>
            <code>pressure = "100 bar"</code>
            <code>flow = "100 m³/s"</code>
            <code>efficiency = 0.7</code>
            <code>power = "100 kW"</code>
          </div>
          <p>
            There is no restriction on the properties that can be defined in a
            block. Different operations may require different properties to be
            defined, and this is enforced by the schema registry at a later
            stage.
          </p>
          <p>
            Units are flexible. You can write any combination of SI, Imperial,
            and CGS units in your expressions.
          </p>
        </div>

        <h3 className="text-lg font-bold">Scope resolution</h3>
        <p>
          Scope resolution rules can be configured globally, per property, or
          per block type.
        </p>
        <p>Properties can be defined at any level of the scope hierarchy.</p>
        <p>
          Inner scopes take priority over outer scopes: A property defined in a
          block will take priority over a property defined in a branch.
        </p>
      </section>
      <section className="flex flex-col justify-center border-b border-brand-grey-3 p-2">
        <h2 className="text-2xl font-bold">Query system</h2>
        <p>
          <span className="italic">Dagger</span> provides a query system for
          extracting data from networks:
        </p>
        <ul className="list-disc list-inside">
          <li>
            <code className="text-brand-grey-3">
              branch-1/blocks[type=Compressor]
            </code>{" "}
            will return all blocks of type Compressor in branch 1.
          </li>
          <li>
            <code className="text-brand-grey-3">
              branch-2/blocks[type=Compressor]/0/pressure
            </code>{" "}
            will return the pressure of the first block of type Compressor in
            branch 2.
          </li>
          <li>
            {" "}
            <code className="text-brand-grey-3">
              branch-3/blocks/1:2[quantity{">"}=2]
            </code>{" "}
            will return the second and third blocks in branch 3 if they have a
            quantity greater than or equal to 2.
          </li>
          <li>
            <code className="text-brand-grey-3">edges[target=branch-2]</code>{" "}
            will return all edges with target branch 2.
          </li>
        </ul>
        <p>
          The query system allows for filtering, range selection, and inspection
          of specific properties and scopes.
        </p>
      </section>
      <section className="flex flex-col justify-center border-b border-brand-grey-3 p-2">
        <h2 className="text-2xl font-bold">
          Schemas, validation, and operations
        </h2>
        <p>
          Description and evaluation are independent. The schema registry is
          used to validate the network against the schemas, and to generate
          forms for editing the network. One operation might require the U-value
          of a pipe, while another might require its material. As the
          description of the network is separate from the operations, the schema
          is enforced at the point where we want to evaluate the network for an
          operation.
        </p>
        <p>
          <span className="italic">Dagger</span> uses a versioned schema
          registry to define the required and optional properties for each block
          type. Schemas are defined in TypeScript files and loaded into the
          schema registry. They can be used to retrieve sets of required and
          optional properties for blocks in the network.
        </p>

        <p>
          Operations that involve evaluating the network, such as costing and
          modelling, are performed by external servers.
        </p>
      </section>
      <section className="flex flex-col justify-center border-b border-brand-grey-3 p-2">
        <h2 className="text-2xl font-bold">Watch mode</h2>

        <p>
          <span className="italic">Dagger</span> can be run in watch mode, which
          will automatically reload the network when the network file is
          changed. The user can see the changes to the network immediately.
        </p>
      </section>

      <section className="flex flex-col justify-center border-b border-brand-grey-3 p-2">
        <h3 className="text-xl font-bold">Comparison to other data models</h3>

        <p>
          The concepts should all feel familiar, but I've used new names in part
          just to avoid confusion. I don't want to use a word that carries some
          extra meaning from another context.
        </p>

        <h4 className="text-lg font-bold">Components and modules</h4>
        <p>
          "Components" and "modules" haven't been thoroughly defined but tend to
          the smallest units of the network. In{" "}
          <span className="italic">Dagger</span>, we use the term "block" to
          describe the same thing. In the same way that a compressor or a cooler
          could be a component/module, a block can be used to represent either
          or both. My intention is for blocks to be the atomic pieces, but if
          any sequence of blocks is repeated enough it might be useful to group
          them together as one block. But I do think it's generally better to
          avoid compound blocks.
        </p>

        <h4 className="text-lg font-bold">Assets</h4>
        <p>
          I use the term "group" to describe any named set of branches. Assets
          have previously had the constraint that all of their modules must be
          continuous, but a group can be used to describe a set of branches that
          are not continuous. Of course, an group can be an asset, but a group
          is not necessarily an asset.
        </p>
      </section>
    </div>
  );
}
