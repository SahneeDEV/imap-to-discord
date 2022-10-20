import { MessageBuilder } from "discord-webhook-node";
import Formatter from "./formatter";
import config from '../config';
import Thing from "../thing/thing";

interface Include {
  id: string;
  content: boolean;
  replace: string | null;
  append: string;
  preprend: string;
}

export default class DefaultFormatter extends Formatter {
  private includes!: Record<string, Include>;

  init() {
    this.includes = {
      ['Subject']: this.readInclude('Subject'),
      ['Sender']: this.readInclude('Sender'),
      ['Body']: this.readInclude('Body'),
      ['Server']: this.readInclude('Server'),
      ['Color']: this.readInclude('Color'),
    };
  }

  readInclude(id: string): Include {
    return {
      id,
      content: config('Include' + id, true, this.options),
      append: config('Append' + id, '', this.options),
      preprend: config('Prepend' + id, '', this.options),
      replace: config('Replace' + id, null, this.options),
    }
  }

  async runInclude<T>(id: string, setFn: (str: string) => Promise<MessageBuilder>, readFn: () => Promise<string | undefined>) {
    const include = this.includes[id];
    let str: undefined | string;
    if (include.replace !== null) {
      str = include.replace;
    } else if (include.content) {
      str = await readFn();
    }
    if (str || include.preprend || include.append) {
      await setFn(this.limit(str, {
        prefix: include.preprend,
        suffix: include.append,
      }));
    }
  }

  async format(thing: Thing) {
    const sourceThing = thing.get<Thing>('source-thing');
    const builder = new MessageBuilder();
    await this.runInclude(
      'Subject',
      async subject => builder.setTitle(subject),
      async () => thing?.get<string>('name'),
    );
    await this.runInclude(
      'Sender',
      async sender => builder.setAuthor(sender),
      async () => this.address(thing.get<any[]>('origin')),
    );
    await this.runInclude(
      'Body',
      async body => builder.setDescription(body),
      async () => this.md(thing.get<string>('content')),
    );
    await this.runInclude(
      'Server',
      async server => builder.setFooter(server),
      async () => `${sourceThing?.get<string>('name')}: ${sourceThing?.get<string>('user')} (${sourceThing?.get<string>('collection')})`,
    ); 
    await this.runInclude(
      'Color',
      async color => builder.setColor(parseInt(color)),
      async () => undefined,
    );  
    return builder;
  }
}
