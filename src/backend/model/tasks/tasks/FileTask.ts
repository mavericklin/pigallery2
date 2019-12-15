import {TaskProgressDTO, TaskState} from '../../../../common/entities/settings/TaskProgressDTO';
import {ConfigTemplateEntry} from '../../../../common/entities/task/TaskDTO';
import {Task} from './Task';
import * as path from 'path';
import {DiskManager} from '../../DiskManger';
import {DiskMangerWorker} from '../../threading/DiskMangerWorker';
import {DirectoryDTO} from '../../../../common/entities/DirectoryDTO';
import {Logger} from '../../../Logger';

declare var global: NodeJS.Global;


const LOG_TAG = '[FileTask]';


export abstract class FileTask<T> extends Task {
  public readonly ConfigTemplate: ConfigTemplateEntry[] = null;
  directoryQueue: string[] = [];
  fileQueue: T[] = [];


  protected constructor(private scanFilter: DiskMangerWorker.DirectoryScanSettings) {
    super();
  }

  protected async init() {
    this.directoryQueue = [];
    this.fileQueue = [];
    this.directoryQueue.push('/');
  }

  protected abstract async processDirectory(directory: DirectoryDTO): Promise<T[]>;

  protected abstract async processFile(file: T): Promise<void>;

  protected async step(): Promise<TaskProgressDTO> {
    if ((this.directoryQueue.length === 0 && this.fileQueue.length === 0)
      || this.state !== TaskState.running) {
      if (global.gc) {
        global.gc();
      }
      return null;
    }

    this.progress.time.current = Date.now();
    if (this.directoryQueue.length > 0) {
      const directory = this.directoryQueue.shift();
      this.progress.comment = 'scanning directory: ' + directory;
      const scanned = await DiskManager.scanDirectory(directory, this.scanFilter);
      for (let i = 0; i < scanned.directories.length; i++) {
        this.directoryQueue.push(path.join(scanned.directories[i].path, scanned.directories[i].name));
      }
      this.fileQueue.push(...await this.processDirectory(scanned));
    } else if (this.fileQueue.length > 0) {
      const file = this.fileQueue.shift();
      this.progress.left = this.fileQueue.length;
      this.progress.progress++;
      this.progress.comment = 'processing: ' + file;
      try {
        await this.processFile(file);
      } catch (e) {
        console.error(e);
        Logger.error(LOG_TAG, 'Error during processing file: ' + e.toString());
      }
    }
    return this.progress;
  }

}